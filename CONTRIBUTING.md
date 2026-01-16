# Contributing to Directory Scraper

Thank you for considering contributing to this project! We welcome contributions from the community.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:

- A clear description of the problem
- Steps to reproduce the issue
- Expected vs actual behavior
- Your environment (OS, Node version, etc.)

### Suggesting Features

We welcome feature suggestions! Please open an issue with:

- Clear description of the feature
- Use cases and benefits
- Any implementation ideas you have

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** with clear, descriptive commits
3. **Test your changes** - ensure `npm run build` succeeds
4. **Update documentation** if you're changing functionality
5. **Submit a pull request** with a clear description

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/solicitor-scraper-eu.git
cd solicitor-scraper-eu

# Install dependencies
npm install

# Build the project
npm run build

# Test your changes
npm start
```

### Coding Guidelines

- Use TypeScript with strict typing
- Follow existing code style and patterns
- Write clear, descriptive variable and function names
- Add comments for complex logic
- Keep functions focused and modular

### Security Guidelines

**CRITICAL: Never commit sensitive data**

Before committing, verify:

- [ ] No `.env` files (except `.env.example`)
- [ ] No API keys, tokens, or credentials in code
- [ ] No personal or client information
- [ ] `.env.example` uses only placeholders like `<your-value-here>`

**Pre-commit hook**: A security hook automatically checks for:

- Staged `.env` files
- AWS access keys
- JWT tokens
- Private keys
- Common secret patterns

**Always use environment variables** for:

- Azure OAuth credentials (CLIENT_ID, CLIENT_SECRET, etc.)
- 2Captcha API keys
- Proxy passwords
- Any sensitive configuration

**Review your changes**:

```bash
# Before committing, review what you're staging
git diff --cached

# Ensure no .env files are staged
git status | grep -E '\.env'
```

See [SECURITY.md](SECURITY.md) for complete security policies.

### Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Reference issues and PRs when relevant
- Keep first line under 72 characters

### Testing

Before submitting a PR:

- Ensure all TypeScript compiles (`npm run build`)
- Test the scraper with sample data
- Verify Excel output is correct
- Check for any console errors

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help create a positive community

## Questions?

Feel free to open an issue for any questions or clarifications!

Thank you for contributing!
