# Contributing to Web Application Firewall

Thank you for your interest in contributing to the WAF project! This document provides guidelines and instructions for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors. Please:
- Be respectful and constructive in discussions
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 22 or higher
- Git
- GeoIP databases (for testing)

### Setup Development Environment

1. **Fork the repository**

   Visit https://github.com/SomeBlackMagic/WebApplicationFirewall and click "Fork"

2. **Clone your fork**

   ```bash
   git clone https://github.com/YOUR-USERNAME/WebApplicationFirewall.git
   cd WebApplicationFirewall
   ```

3. **Add upstream remote**

   ```bash
   git remote add upstream https://github.com/SomeBlackMagic/WebApplicationFirewall.git
   ```

4. **Install dependencies**

   ```bash
   npm install
   ```

5. **Download GeoIP databases**

   ```bash
   wget https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-Country.mmdb
   wget https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb
   ```

6. **Create configuration**

   ```bash
   cp config.example.yaml config.yaml
   ```

7. **Run tests**

   ```bash
   npm test
   ```

## Development Workflow

### 1. Create a Branch

Create a feature branch for your changes:

```bash
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/what-changed` - Documentation updates
- `refactor/component-name` - Code refactoring
- `test/what-tested` - Test additions/improvements

### 2. Make Changes

- Write clear, readable code
- Follow the coding standards (see below)
- Add tests for new features
- Update documentation as needed
- Commit regularly with clear messages

### 3. Keep Your Branch Updated

Regularly sync with upstream:

```bash
git fetch upstream
git rebase upstream/main
```

### 4. Run Tests

Before submitting, ensure all tests pass:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run linter
npm run lint
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Provide type annotations for function parameters and return values
- Avoid `any` type - use specific types or `unknown`
- Use interfaces for object shapes

**Example**:

```typescript
// Good
interface BanInfo {
    ip: string;
    unbanTime: number;
    escalationCount: number;
}

function banUser(ip: string, duration: number): BanInfo {
    // ...
}

// Bad
function banUser(ip, duration) {  // Missing types
    // ...
}
```

### Code Style

- **Indentation**: 4 spaces
- **Line length**: Max 120 characters
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Trailing commas**: Use in multiline objects/arrays

The project uses ESLint and Prettier for code formatting. Run:

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
npm run format      # Format with Prettier
```

### Naming Conventions

- **Files**: camelCase (e.g., `jailManager.ts`)
- **Classes**: PascalCase (e.g., `JailManager`)
- **Interfaces**: PascalCase (e.g., `BanInfo`)
- **Functions/Methods**: camelCase (e.g., `blockIp()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_TIMEOUT`)
- **Private members**: Prefix with underscore (e.g., `_internalState`)

### Comments

- Use JSDoc for public APIs and complex functions
- Keep comments concise and up-to-date
- Explain *why*, not *what* (code should be self-documenting)

**Example**:

```typescript
/**
 * Bans an IP address for the specified duration
 * @param ip - IP address to ban
 * @param duration - Ban duration in seconds
 * @param ruleId - ID of the rule that triggered the ban
 * @returns Ban information including unban time
 */
function banIp(ip: string, duration: number, ruleId: string): BanInfo {
    // Implementation
}
```

## Testing

### Writing Tests

- Write tests for all new features
- Maintain or improve code coverage
- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert

**Example**:

```typescript
describe('JailManager', () => {
    describe('blockIp', () => {
        it('should ban IP for specified duration', () => {
            // Arrange
            const jailManager = new JailManager(config);
            const ip = '1.2.3.4';
            const duration = 300;

            // Act
            const result = jailManager.blockIp(ip, duration, 'test-rule');

            // Assert
            expect(result.ip).toBe(ip);
            expect(result.unbanTime).toBeGreaterThan(Date.now());
        });
    });
});
```

### Running Tests

```bash
# All tests
npm test

# Specific file
npm test -- jail-manager.test.ts

# Watch mode
npm test -- --watch

# Coverage
npm run test:cov
```

### Test Coverage

- Aim for >80% code coverage
- Focus on critical paths and edge cases
- Don't sacrifice test quality for coverage numbers

## Submitting Changes

### Commit Messages

Follow conventional commits format:

```
type(scope): short description

Longer description if needed

Fixes #123
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:

```
feat(jail): add support for Redis storage

Implements Redis backend for JailManager to support
multi-instance deployments.

Fixes #45
```

```
fix(geoip): handle missing city data gracefully

Previously, requests from IPs without city data would crash.
Now returns "Unknown" for city when data is unavailable.

Fixes #78
```

### Pull Request Process

1. **Push your branch**

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request**

   - Go to GitHub and create a PR from your branch
   - Fill out the PR template completely
   - Link related issues (e.g., "Fixes #123")

3. **PR Title**

   Use conventional commit format:
   ```
   feat(component): description
   ```

4. **PR Description**

   Include:
   - What changed and why
   - How to test the changes
   - Screenshots (if UI changes)
   - Breaking changes (if any)

5. **Checks**

   Ensure all automated checks pass:
   - Tests
   - Linter
   - Build

6. **Code Review**

   - Address reviewer feedback
   - Push additional commits to the same branch
   - Be responsive and respectful

7. **Merge**

   Once approved, a maintainer will merge your PR.

### PR Checklist

Before submitting, verify:

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] No linter errors
- [ ] Commit messages follow conventions
- [ ] PR description is complete

## Reporting Issues

### Bug Reports

When reporting bugs, include:

1. **Description**: Clear description of the bug
2. **Steps to Reproduce**: Minimal steps to trigger the bug
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**:
   - OS and version
   - Node.js version
   - WAF version
   - Configuration (sanitized)
6. **Logs**: Relevant log output
7. **Additional Context**: Screenshots, related issues, etc.

**Template**:

```markdown
**Describe the bug**
A clear description...

**To Reproduce**
1. Set config to...
2. Send request...
3. Observe error...

**Expected behavior**
Should have...

**Environment**
- OS: Ubuntu 22.04
- Node: v22.0.0
- WAF: v1.2.3

**Logs**
```
[ERROR] ...
```

**Additional context**
...
```

### Feature Requests

When requesting features, include:

1. **Problem**: What problem does this solve?
2. **Solution**: Proposed solution
3. **Alternatives**: Alternative solutions considered
4. **Use Case**: Real-world scenario
5. **Priority**: How important is this?

## Documentation

### Documentation Guidelines

- Write in clear, concise English
- Use code examples liberally
- Keep documentation up-to-date with code changes
- Follow the existing documentation structure

### Documentation Changes

- Update relevant files in `docs/`
- Update README.md if needed
- Include documentation in your PR

## Questions?

- **Documentation**: Check [docs/](docs/)
- **Discussions**: [GitHub Discussions](https://github.com/SomeBlackMagic/WebApplicationFirewall/discussions)
- **Issues**: [GitHub Issues](https://github.com/SomeBlackMagic/WebApplicationFirewall/issues)

## License

By contributing, you agree that your contributions will be licensed under the GNU License.

---

Thank you for contributing to WAF! 🎉
