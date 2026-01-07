# LSP Setup Guide

Language Server Protocol (LSP) support is now configured for both client and server.

## Claude Code CLI Setup

### Built-in Language Support

**Good news!** Claude Code has built-in TypeScript and ESLint support. No additional LSP configuration needed.

### What's Already Working

Claude Code automatically provides:
- ✅ **TypeScript checking** - Uses local `tsconfig.json`
- ✅ **ESLint integration** - Uses local `.eslintrc.cjs` / `eslint.config.js`
- ✅ **Syntax highlighting** - For `.ts`, `.tsx`, `.js`, `.jsx` files
- ✅ **Error detection** - Shows TypeScript and ESLint errors

### How to Use in Claude Code

1. **Read files with context**:
   ```
   Read the TradingChart.tsx file
   ```
   Claude will see TypeScript types and ESLint errors automatically.

2. **Ask about errors**:
   ```
   What are the TypeScript errors in this file?
   ```
   Claude can see and fix type errors.

3. **Request linting**:
   ```
   Run ESLint on the server code
   ```
   Claude can run `npm run lint` and fix issues.

### Manual Linting

You can always run ESLint manually:
```bash
cd client && npm run lint
cd server && npm run lint
cd server && npm run lint:fix  # Auto-fix
```

---

## What You Get

✅ **Autocomplete & IntelliSense** - Smart code completion with type information
✅ **Go to Definition** (F12) - Jump to function/variable definitions
✅ **Find References** (Shift+F12) - See all usages of a symbol
✅ **Real-time Error Checking** - See TypeScript and ESLint errors as you type
✅ **Auto-Import** - Automatically add missing imports
✅ **Quick Fixes** - Auto-fix ESLint issues on save

## Activation

### VS Code (Recommended)

1. **Restart VS Code** or reload window:
   - Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
   - Type "Reload Window" and select it

2. **Install Recommended Extensions** (optional but recommended):
   - ESLint (`dbaeumer.vscode-eslint`)
   - TypeScript Next (`ms-vscode.vscode-typescript-next`)
   - ES7+ React/Redux/React-Native snippets
   - Tailwind CSS IntelliSense
   - Path Intellisense

3. **Verify LSP is Working**:
   - Open any `.ts` or `.tsx` file
   - Hover over a variable - you should see type information
   - Press F12 on a function name - it should jump to definition
   - Type `console.` - you should see autocomplete

### Other IDEs

#### Neovim
```lua
-- Add to your LSP config
require'lspconfig'.tsserver.setup{}
require'lspconfig'.eslint.setup{}
```

#### Sublime Text
Install packages:
- LSP
- LSP-typescript
- LSP-eslint

#### Emacs
```elisp
(use-package lsp-mode
  :hook ((typescript-mode . lsp)
         (typescript-tsx-mode . lsp)))
```

## Manual Configuration (Optional)

If you want to customize VS Code settings, create `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "eslint.enable": true,
  "eslint.workingDirectories": ["./client", "./server"],
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

## Running ESLint Manually

### Client (React)
```bash
cd client
npm run lint           # Check for issues
```

### Server (Express)
```bash
cd server
npm run lint           # Check for issues
npm run lint:fix       # Auto-fix issues
```

## Configuration Files

- **Client**: `client/.eslintrc.cjs` (ESLint 8 format)
- **Server**: `server/eslint.config.js` (ESLint 9 flat config)
- **TypeScript**: `tsconfig.json` in both client/ and server/

## Troubleshooting

### Claude Code Issues

1. **TypeScript errors not showing**:
   - Ensure `tsconfig.json` exists in project root
   - Check file extension is `.ts` or `.tsx`
   - Ask Claude: "What are the TypeScript errors in this file?"

2. **ESLint not running**:
```bash
# Verify ESLint is installed
cd client && npm list eslint
cd server && npm list eslint

# Run manually
npm run lint
```

3. **Want to see all errors**:
   - Ask Claude: "Run lint on both client and server"
   - Claude will execute and show you all issues

### LSP Not Working (VS Code)

1. **Check TypeScript version**: Both client and server use TypeScript 5.9.3
2. **Restart Language Server**:
   - VS Code: `Ctrl+Shift+P` → "TypeScript: Restart TS Server"
3. **Check for errors**:
   - VS Code: View → Output → Select "TypeScript" from dropdown

### ESLint Not Running

1. **Check ESLint extension is installed** (VS Code)
2. **Reload window**: `Ctrl+Shift+P` → "Reload Window"
3. **Check ESLint output**:
   - VS Code: View → Output → Select "ESLint" from dropdown

### Autocomplete Not Working

1. **Ensure you're in a `.ts` or `.tsx` file**
2. **Check if TypeScript SDK is being used**:
   - VS Code: Bottom right corner → Click TypeScript version
   - Select "Use Workspace Version" (should be 5.9.3)

### Performance Issues

If LSP is slow, try:
1. Close unused files
2. Exclude node_modules from search:
   - Already configured in `.vscode/settings.json`
3. Restart IDE

## Current ESLint Issues

The project currently has some ESLint warnings and errors:

### Server (15 issues)
- 5 errors: Use `@ts-expect-error` instead of `@ts-ignore`
- 10 warnings: Unused variables, `any` types

### Client (40+ issues)
- React Hook dependency warnings
- `@ts-ignore` comments (should be `@ts-expect-error`)
- Unused variables
- `any` types

These are **warnings only** - they don't prevent the code from running. You can:
- Fix them gradually
- Ignore specific rules in config
- Use `// eslint-disable-next-line` for individual exceptions

## Next Steps

1. **Enable format on save** - Auto-fix code style issues
2. **Learn keyboard shortcuts**:
   - F12: Go to definition
   - Shift+F12: Find all references
   - Ctrl+.: Quick fix
   - Ctrl+Space: Trigger autocomplete
3. **Customize rules** - Edit `.eslintrc.cjs` or `eslint.config.js`
4. **Add more plugins** - Prettier, Import sorting, etc.

## Resources

- [TypeScript LSP](https://github.com/typescript-language-server/typescript-language-server)
- [ESLint](https://eslint.org/)
- [VS Code TypeScript](https://code.visualstudio.com/docs/languages/typescript)
- [React with TypeScript](https://react-typescript-cheatsheet.netlify.app/)

---

**Note**: The `.vscode/` directory is in `.gitignore`, so your personal IDE settings won't be committed. The ESLint configs are committed and shared across the team.
