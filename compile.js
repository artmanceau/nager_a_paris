const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const CONTENT_DIR = path.join(__dirname, '_pools');
const OUTPUT_FILE = path.join(__dirname, 'data.json');

function compile() {
  console.log('🚀 Compiling markdown files to JSON...');

  try {
    const files = fs.readdirSync(CONTENT_DIR).filter(file => file.endsWith('.md'));
    const poolData = [];

    files.forEach(file => {
      const filePath = path.join(CONTENT_DIR, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');

      // gray-matter parses the YAML frontmatter automatically
      const { data, content } = matter(fileContent);

      poolData.push({
        ...data,
        body: content.trim() // Keep the markdown body if needed
      });
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(poolData, null, 2), 'utf8');
    console.log(`✅ Successfully compiled ${poolData.length} pools to ${OUTPUT_FILE}`);
  } catch (error) {
    console.error('❌ Compilation failed:', error);
    process.exit(1);
  }
}

compile();
