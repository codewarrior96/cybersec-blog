const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/components/dashboard/DashboardLayout.tsx');
let content = fs.readFileSync(file, 'utf8');

// fix double declaration
content = content.replace(
  /const containedNodesRef = useRef<string\[\]>\(\[\]\)\r?\n\s*const containedNodesRef = useRef<string\[\]>\(\[\]\)/,
  'const containedNodesRef = useRef<string[]>([])'
);

fs.writeFileSync(file, content);
console.log('Fixed types');
