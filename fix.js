const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/dashboard/DashboardLayout.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add containedNodesRef
content = content.replace(
  'const incidentsRef = useRef<Incident[]>([])',
  'const incidentsRef = useRef<Incident[]>([])\n  const containedNodesRef = useRef<string[]>([])'
);

// 2. Add useEffect for containedNodesRef
content = content.replace(
  '  useEffect(() => {\n    incidentsRef.current = incidents\n  }, [incidents])\n\n  // Simulation Tick',
  '  useEffect(() => {\n    incidentsRef.current = incidents\n  }, [incidents])\n\n  useEffect(() => {\n    containedNodesRef.current = containedNodes\n  }, [containedNodes])\n\n  // Simulation Tick'
);

// 3. Remove setContainedNodes from interval
let match = content.match(/const interval = setInterval\(\(\) => \{\s*setContainedNodes\(currentContained => \{\s*const newEvent = generateEvent\(currentContained\)/);
if (match) {
  content = content.replace(
    /const interval = setInterval\(\(\) => \{\s*setContainedNodes\(currentContained => \{/g,
    'const interval = setInterval(() => {\n      const currentContained = containedNodesRef.current;'
  );
  
  // Now remove the closing 'return currentContained \n })'
  content = content.replace(
    /return currentContained\s*\}\)/,
    ''
  );
} else {
  // try matching windows CRLF
  content = content.replace(
    /const interval = setInterval\(\(\) => \{\r\n      setContainedNodes\(currentContained => \{/g,
    'const interval = setInterval(() => {\r\n      const currentContained = containedNodesRef.current;'
  );
  content = content.replace(
    /return currentContained\r\n      \}\)/,
    ''
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed DashboardLayout.tsx');
