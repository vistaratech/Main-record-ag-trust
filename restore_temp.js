const fs = require('fs');
const path = require('path');

const transcriptPath = 'C:\\Users\\VRED\\.gemini\\antigravity\\brain\\20446d7f-fe9e-47f4-96c4-08c3d478c14c\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(transcriptPath)) {
  console.error('Transcript file not found at:', transcriptPath);
  process.exit(1);
}

const file = fs.readFileSync(transcriptPath, 'utf8');
const lines = file.split('\n');

const filesToRestore = [
  'verify_db.js',
  'migrate.js',
  'migrate_auth.js',
  'api/index.js',
  'src/lib/firebaseAuth.ts',
  'src/lib/api.ts'
];

console.log('Starting file recovery from transcript...');

for (const line of lines) {
  if (!line) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.tool_calls) {
      for (const tc of obj.tool_calls) {
        if (tc.name === 'write_to_file' || tc.name === 'replace_file_content') {
          // Parse target file path
          let target = tc.args.TargetFile;
          if (target.startsWith('"') && target.endsWith('"')) {
            target = JSON.parse(target);
          }
          
          // Match with files to restore
          const matchedFile = filesToRestore.find(f => {
            const normalizedTarget = target.replace(/\\/g, '/').toLowerCase();
            const normalizedF = f.toLowerCase();
            return normalizedTarget.endsWith('/' + normalizedF);
          });
          
          if (matchedFile) {
            let code = tc.args.CodeContent || tc.args.ReplacementContent;
            if (code.startsWith('"') && code.endsWith('"')) {
              code = JSON.parse(code);
            }
            
            const writePath = path.resolve('c:/Users/VRED/Desktop/Main Record Neon', matchedFile);
            fs.mkdirSync(path.dirname(writePath), { recursive: true });
            fs.writeFileSync(writePath, code, 'utf8');
            console.log(`Successfully restored: ${matchedFile} -> ${writePath} (${code.length} bytes)`);
          }
        }
      }
    }
  } catch (e) {
    // Ignore JSON parsing errors for lines that are not full JSON or have bad escapes
  }
}

console.log('Recovery complete!');
