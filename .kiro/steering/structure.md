# Project Structure

This document outlines the recommended project organization and folder structure conventions.

## General Principles
- Keep related files together
- Use clear, descriptive folder and file names
- Separate source code from configuration and documentation
- Follow language/framework conventions when applicable

## Common Directory Structure

create a monorepo project structure

```
project-root/
├── .kiro/                  # Kiro configuration and steering
│   └── steering/           # AI assistant guidance documents
├── src/                    # Source code
│   ├── components/         # Reusable components (frontend)
│   ├── pages/              # Page components or routes
│   ├── utils/              # Utility functions
│   ├── types/              # Type definitions (TypeScript)
│   └── assets/             # Static assets (images, fonts)
├── tests/                  # Test files
├── docs/                   # Documentation
├── config/                 # Configuration files
├── scripts/                # Build and deployment scripts
├── public/                 # Public static files (frontend)
├── README.md               # Project overview and setup
├── package.json            # Dependencies and scripts (Node.js)
├── requirements.txt        # Dependencies (Python)
└── .gitignore              # Git ignore rules
```

## File Naming Conventions
- Use kebab-case for files and folders: `user-profile.js`
- Use PascalCase for React components: `UserProfile.jsx`
- Use camelCase for JavaScript functions and variables
- Use UPPER_CASE for constants and environment variables

## Code Organization
- Group related functionality together
- Keep components small and focused
- Use index files for clean imports
- Separate business logic from UI components
- Create shared utilities for common operations

## Configuration Files
- Keep configuration at the project root
- Use environment-specific config files when needed
- Document required environment variables
- Use consistent naming for config files