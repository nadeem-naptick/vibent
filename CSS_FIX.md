# CSS Import Issue Fix

## Issue
50% of generated React projects loaded with plain HTML styling because AI was overwriting the template `main.jsx` file without the required `import './index.css'`.

## Root Cause
- E2B template correctly includes CSS import in `main.jsx`
- AI generation overwrites template file without preserving the import
- Missing import means Tailwind CSS never loads

## Solution
Added bulletproof fix to E2B provider `writeFile()` method that automatically adds the CSS import whenever `main.jsx` is written:

```typescript
// In /lib/sandbox/providers/e2b-provider.ts writeFile()
if (path === 'src/main.jsx' || path === 'main.jsx') {
  const hasIndexCssImport = /import\s+['"][^'"]*index\.css['"][;\s]*$/m.test(content);
  if (!hasIndexCssImport) {
    // Auto-add import './index.css' after existing imports
    lines.splice(insertIndex + 1, 0, "import './index.css'");
    console.log('[E2BProvider] ✅ Fixed: Added missing index.css import to main.jsx');
  }
}
```

**Result:** Every `main.jsx` file now automatically gets the CSS import, regardless of AI model. Plain HTML issue eliminated.