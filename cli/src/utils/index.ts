/**
 * @fileoverview Utility functions exports for Curupira CLI
 */

// Project detection utilities
export {
  detectProject,
  detectPackageManager,
  checkForUpdates,
  validateProject
} from './project-detector.js'

export type {
  ProjectDetection,
  UpdateInfo
} from './project-detector.js'

// Template generation utilities
export {
  generateConfigTemplate,
  generateFrameworkTemplate,
  loadTemplateFile,
  validateTemplate
} from './template-generator.js'