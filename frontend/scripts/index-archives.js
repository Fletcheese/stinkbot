const { Client } = require('@opensearch-project/opensearch');
const fs = require('fs');
const path = require('path');

async function indexArchives() {
    console.log('📚 Indexing archive files into OpenSearch...');

    // Create OpenSearch client for localhost
    const client = new Client({
        node: 'http://localhost:9200'
    });

    try {
        // Get all archive files from the root directory
        const rootDir = path.join(__dirname, '..', '..');
        const files = fs.readdirSync(rootDir).filter(file => 
            file.startsWith('archive_') && file.endsWith('.json')
        );

        console.log(`📁 Found ${files.length} archive files to process`);

        let totalMessages = 0;
        let indexedMessages = 0;

        for (const file of files) {
            console.log(`\n📄 Processing ${file}...`);
            
            const filePath = path.join(rootDir, file);
            const archiveData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            // Process each channel in the archive
            for (const channel of archiveData.channels) {
                console.log(`  📺 Processing channel: ${channel.channelName} (${channel.messageCount} messages)`);
                
                for (const message of channel.messages) {
                    // Prepare the document for indexing
                    const document = {
                        messageId: message.messageId,
                        content: message.content || '',
                        timestamp: message.timestamp,
                        userId: message.userId,
                        username: message.username,
                        displayName: message.displayName,
                        channelId: message.channelId,
                        channelName: message.channelName,
                        category: archiveData.category,
                        categoryId: archiveData.categoryId,
                        replyToMessageId: message.replyToMessageId || null,
                        attachments: message.attachments || [],
                        embeds: message.embeds || [],
                        reactions: message.reactions || [],
                        archivedAt: archiveData.archivedAt,
                        archivedBy: archiveData.archivedBy,
                        contentLength: (message.content || '').length,
                        hasAttachments: (message.attachments || []).length > 0,
                        hasEmbeds: (message.embeds || []).length > 0,
                        hasReactions: (message.reactions || []).length > 0,
                        isReply: !!message.replyToMessageId
                    };

                    try {
                        // Index the message
                        await client.index({
                            index: 'messages',
                            body: document
                        });
                        indexedMessages++;
                    } catch (error) {
                        console.error(`    ❌ Error indexing message ${message.messageId}:`, error.message);
                    }
                }
                
                totalMessages += channel.messageCount;
            }
        }

        // Refresh the index to make documents searchable
        await client.indices.refresh({ index: 'messages' });

        console.log(`\n🎉 Indexing completed!`);
        console.log(`📊 Total messages processed: ${totalMessages}`);
        console.log(`✅ Successfully indexed: ${indexedMessages} messages`);

        // Get index stats
        const stats = await client.indices.stats({ index: 'messages' });
        console.log(`📈 Index document count: ${stats.body.indices.messages.total.docs.count}`);

    } catch (error) {
        console.error('❌ Error indexing archives:', error);
        if (error.meta && error.meta.body) {
            console.error('Error details:', JSON.stringify(error.meta.body, null, 2));
        }
        process.exit(1);
    }
}

// Run the indexing if this script is executed directly
if (require.main === module) {
    indexArchives();
}

module.exports = { indexArchives };
