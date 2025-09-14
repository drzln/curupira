# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

Please report security vulnerabilities to **security@pleme.io**.

### What to Include

Please include the following details in your report:

- Description of the vulnerability
- Steps to reproduce
- Possible impact
- Suggested fix (if any)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: Within 7 days
  - High: Within 14 days
  - Medium: Within 30 days
  - Low: Next regular release

### Disclosure Policy

- We will acknowledge receipt of your vulnerability report
- We will work with you to understand and validate the issue
- We will develop and test a fix
- We will prepare a security advisory
- We will release the fix and publish the advisory

## Security Best Practices

When using Curupira:

1. **Environment Variables**: Never commit `.env` files with real credentials
2. **Authentication**: Enable authentication in production environments
3. **CORS**: Configure allowed origins restrictively
4. **Rate Limiting**: Adjust rate limits based on your needs
5. **Network Security**: Use HTTPS/WSS in production
6. **Updates**: Keep Curupira updated to the latest version

## Security Features

Curupira includes several security features:

- JWT authentication support
- CORS protection
- Rate limiting
- Input sanitization
- Secure WebSocket connections
- Environment variable configuration

## Dependencies

We regularly update dependencies to patch known vulnerabilities. Run `npm audit` to check for vulnerabilities in your installation.