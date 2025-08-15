import * as Y from 'yjs';

export function createIndexingQueue(mongoClient, persistence) {
  const queue = new Map();
  const processing = new Set();
  const activeDocs = new Map(); // Store active Y.js documents
  let isRunning = false;
  let processInterval;

  const db = mongoClient.db();
  const docsCollection = db.collection('docs');

  async function processQueue() {
    if (queue.size === 0) return;

    const batch = Array.from(queue.entries()).slice(0, 10); // Process up to 10 at a time
    
    for (const [roomId, userId] of batch) {
      if (processing.has(roomId)) continue;
      
      processing.add(roomId);
      queue.delete(roomId);

      try {
        await indexDocument(roomId, userId);
      } catch (error) {
        console.error(`❌ Failed to index document ${roomId}:`, error);
      } finally {
        processing.delete(roomId);
      }
    }
  }

  async function indexDocument(roomId, lastModifiedBy) {
    try {
      console.log(`📊 Indexing document: ${roomId}`);

      // Get the active document from memory or create a placeholder
      let ydoc = activeDocs.get(roomId);
      let content = '';
      let title = '';

      if (ydoc) {
        // Extract content from active Y.js document
        const contentText = ydoc.getText('content');
        const titleText = ydoc.getText('title');
        
        content = contentText.toString();
        title = titleText.toString() || extractTitleFromContent(content) || `Document ${roomId}`;
      } else {
        // Document not in memory, check if we have persistence
        if (persistence) {
          // Load from LevelDB
          const docName = `room:${roomId}`;
          ydoc = new Y.Doc();
          
          const persistedState = await persistence.getYDoc(docName);
          if (persistedState) {
            Y.applyUpdate(ydoc, persistedState);
            
            const contentText = ydoc.getText('content');
            const titleText = ydoc.getText('title');
            
            content = contentText.toString();
            title = titleText.toString() || extractTitleFromContent(content) || `Document ${roomId}`;
          }
        } else {
          // No persistence and not in memory - this might be a stale queue item
          console.log(`⚠️ Document ${roomId} not found in memory or persistence - skipping indexing`);
          return;
        }
      }
      
      // Extract additional metadata
      const metadata = {
        _id: roomId,
        title: title.trim(),
        content: content, // Store full content for search (consider truncating for large docs)
        wordCount: countWords(content),
        characterCount: content.length,
        lineCount: content.split('\n').length,
        lastModifiedBy,
        lastModified: new Date(),
        roomId: roomId,
        tags: extractTags(content),
        isEmpty: content.trim().length === 0,
        editCount: 1 // Will be incremented on updates
      };

      // Check if document already exists to increment edit count
      const existingDoc = await docsCollection.findOne({ _id: roomId });
      if (existingDoc) {
        metadata.editCount = (existingDoc.editCount || 0) + 1;
        metadata.createdAt = existingDoc.createdAt;
      } else {
        metadata.createdAt = new Date();
      }

      // Upsert to MongoDB
      await docsCollection.replaceOne(
        { _id: roomId },
        metadata,
        { upsert: true }
      );

      console.log(`✅ Document indexed: ${roomId} (${metadata.wordCount} words, ${metadata.editCount} edits)`);

    } catch (error) {
      console.error(`❌ Error indexing document ${roomId}:`, error);
      throw error;
    }
  }

  function extractTitleFromContent(content) {
    if (!content) return null;

    // Try to extract title from first line
    const lines = content.split('\n');
    const firstLine = lines[0]?.trim();
    
    if (firstLine && firstLine.length > 0 && firstLine.length <= 100) {
      // Remove common markdown headers
      return firstLine.replace(/^#+\s*/, '').trim();
    }

    // Fallback: use first 50 characters
    const excerpt = content.trim().substring(0, 50);
    return excerpt.length === 50 ? excerpt + '...' : excerpt;
  }

  function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  function extractTags(content) {
    if (!content) return [];

    const tags = new Set();
    
    // Extract hashtags
    const hashtagMatches = content.match(/#\w+/g);
    if (hashtagMatches) {
      hashtagMatches.forEach(tag => tags.add(tag.toLowerCase()));
    }

    // Extract @mentions as tags
    const mentionMatches = content.match(/@\w+/g);
    if (mentionMatches) {
      mentionMatches.forEach(mention => tags.add(mention.toLowerCase()));
    }

    // Extract common keywords (simple implementation)
    const commonWords = ['todo', 'fixme', 'note', 'important', 'urgent', 'meeting', 'project'];
    const words = content.toLowerCase().split(/\s+/);
    commonWords.forEach(word => {
      if (words.includes(word)) {
        tags.add(`#${word}`);
      }
    });

    return Array.from(tags).slice(0, 20); // Limit to 20 tags
  }

  return {
    async start() {
      if (isRunning) return;
      
      isRunning = true;
      console.log('🎯 Document indexing queue started');
      
      // Process queue every 5 seconds
      processInterval = setInterval(processQueue, 5000);
      
      // Also create indexes in MongoDB
      try {
        await docsCollection.createIndex({ title: 'text', content: 'text' });
        await docsCollection.createIndex({ lastModified: -1 });
        await docsCollection.createIndex({ lastModifiedBy: 1 });
        await docsCollection.createIndex({ tags: 1 });
        await docsCollection.createIndex({ roomId: 1 });
        console.log('✅ MongoDB indexes created');
      } catch (error) {
        console.error('❌ Failed to create MongoDB indexes:', error);
      }
    },

    async stop() {
      if (!isRunning) return;
      
      isRunning = false;
      if (processInterval) {
        clearInterval(processInterval);
      }
      
      // Process remaining items
      await processQueue();
      console.log('🛑 Document indexing queue stopped');
    },

    enqueue(roomId, userId) {
      if (!isRunning) return;
      
      queue.set(roomId, userId);
      console.log(`📋 Queued for indexing: ${roomId} (queue size: ${queue.size})`);
    },

    // Register an active Y.js document for indexing
    registerDocument(roomId, ydoc) {
      activeDocs.set(roomId, ydoc);
      console.log(`📄 Registered active document: ${roomId}`);
    },

    // Unregister a document when it's no longer active
    unregisterDocument(roomId) {
      activeDocs.delete(roomId);
      console.log(`📄 Unregistered document: ${roomId}`);
    },

    getQueueSize() {
      return queue.size;
    },

    getProcessingCount() {
      return processing.size;
    },

    getActiveDocumentCount() {
      return activeDocs.size;
    },

    async getDocumentMetadata(roomId) {
      try {
        return await docsCollection.findOne({ _id: roomId });
      } catch (error) {
        console.error(`❌ Failed to get document metadata for ${roomId}:`, error);
        return null;
      }
    },

    async searchDocuments(query, limit = 20) {
      try {
        const searchQuery = {
          $or: [
            { title: { $regex: query, $options: 'i' } },
            { content: { $regex: query, $options: 'i' } },
            { tags: { $in: [new RegExp(query, 'i')] } }
          ]
        };

        return await docsCollection
          .find(searchQuery)
          .sort({ lastModified: -1 })
          .limit(limit)
          .project({ content: 0 }) // Exclude full content from search results
          .toArray();
      } catch (error) {
        console.error(`❌ Failed to search documents:`, error);
        return [];
      }
    },

    async getRecentDocuments(limit = 10) {
      try {
        return await docsCollection
          .find({ isEmpty: { $ne: true } })
          .sort({ lastModified: -1 })
          .limit(limit)
          .project({ content: 0 })
          .toArray();
      } catch (error) {
        console.error(`❌ Failed to get recent documents:`, error);
        return [];
      }
    }
  };
}
