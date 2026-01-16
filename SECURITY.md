# Security Policy

## Reporting a Vulnerability

We take the security of this project seriously. If you discover a security vulnerability, please follow these steps:

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email the maintainers directly at: [Your Security Email]
3. Include the following information:
   - Type of vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- Initial response: Within 48 hours
- Status update: Within 7 days
- Fix timeline: Depends on severity and complexity

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < 1.0   | :x:                |

## Security Best Practices

### For Contributors

1. **Never commit sensitive data**:
   - API keys, tokens, or credentials
   - `.env` files (except `.env.example`)
   - Personal or client information
   - Database credentials

2. **Use environment variables**:
   - All credentials must be loaded from `.env` files
   - Use `.env.example` as a template with placeholder values
   - Never hardcode secrets in source code

3. **Review before pushing**:
   - Run `git diff --cached` before committing
   - Check for accidentally staged `.env` files
   - Verify no credentials in commit messages

4. **Pre-commit hook**:
   - Automatically installed to prevent `.env` commits
   - Scans for common secret patterns
   - Can be bypassed only with explicit confirmation

### For Users

1. **Protect your `.env` file**:
   - Never share or commit this file
   - Use strong, unique credentials
   - Rotate credentials if potentially exposed

2. **Azure OAuth credentials**:
   - Keep CLIENT_SECRET secure
   - Refresh tokens have long lifetime - protect them
   - Rotate credentials after public deployment

3. **2Captcha API key**:
   - Keep your CAPTCHA_API_KEY private
   - Monitor usage to detect unauthorized use
   - Regenerate if compromised

4. **Proxy credentials**:
   - Use unique passwords for proxy services
   - Avoid sharing credentials across projects
   - Consider using credential managers

## Known Security Considerations

### OAuth Server Script

The `scripts/oauth-server.ts` intentionally displays credentials in:

- Browser window (for copy-paste convenience)
- Console output (for terminal workflow)

**Security notes**:

- Only run this script locally
- Never expose port 3000 to the internet
- Close the server immediately after getting tokens
- Clear browser history after use

### reCAPTCHA Site Key

The public reCAPTCHA site key is hardcoded in `src/main.ts`:

```typescript
const captchaSiteKey = "6LcL6zkrAAAAABu2p8Hpe_zhwyCFxKng3hZcvj5S";
```

**This is safe** - reCAPTCHA site keys are meant to be public and visible in client-side code. Only the secret key must be protected (which is managed by Google's servers).

### OneDrive Integration

Scraped data is uploaded to OneDrive:

- Uses OAuth 2.0 with refresh tokens
- Tokens stored in `.env` file (gitignored)
- Access tokens expire in ~1 hour
- Refresh tokens used for automatic renewal

## Security Checklist Before Public Release

- [ ] All `.env*` files properly gitignored (except `.env.example`)
- [ ] No credentials in source code or git history
- [ ] `.env.example` uses only placeholder values
- [ ] Pre-commit hook installed and tested
- [ ] README.md contains no real credentials
- [ ] All scripts reviewed for credential exposure
- [ ] Azure app registration configured correctly
- [ ] Rotate all credentials after initial public push

## Vulnerability Disclosure

If a vulnerability is confirmed, we will:

1. Develop and test a fix
2. Release a security patch
3. Update this document with mitigation steps
4. Credit the reporter (unless anonymity requested)

---

**Remember**: Security is everyone's responsibility. When in doubt, ask before committing.
