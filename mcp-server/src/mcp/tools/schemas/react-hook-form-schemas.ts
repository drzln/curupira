/**
 * React Hook Form Tool JSON Schemas - Level 2 (MCP Core)
 * JSON Schema definitions for React Hook Form debugging tools following MCP protocol requirements
 * Tailored for NovaSkyn's form management architecture
 */

export const reactHookFormToolSchemas = {
  react_hook_form_detect: {
    type: 'object',
    properties: {
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  react_hook_form_inspect: {
    type: 'object',
    properties: {
      formId: { 
        type: 'string', 
        description: 'Specific form ID to inspect (e.g., loginForm, registrationForm)'
      },
      includeValues: { 
        type: 'boolean', 
        description: 'Include form values in output',
        default: true
      },
      includeErrors: { 
        type: 'boolean', 
        description: 'Include form errors in output',
        default: true
      },
      includeState: { 
        type: 'boolean', 
        description: 'Include form state (dirty, valid, submitting, etc.)',
        default: true
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  react_hook_form_field_inspect: {
    type: 'object',
    properties: {
      fieldName: { 
        type: 'string', 
        description: 'Name of the form field to inspect (e.g., email, password, firstName)'
      },
      formId: { 
        type: 'string', 
        description: 'Specific form ID to search within'
      },
      includeValidation: { 
        type: 'boolean', 
        description: 'Include field validation rules and constraints',
        default: true
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['fieldName']
  },

  react_hook_form_trigger_validation: {
    type: 'object',
    properties: {
      formId: { 
        type: 'string', 
        description: 'Specific form ID to trigger validation on'
      },
      fieldName: { 
        type: 'string', 
        description: 'Specific field name to validate'
      },
      triggerAll: { 
        type: 'boolean', 
        description: 'Trigger validation for all fields in the form',
        default: false
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  react_hook_form_test_submit: {
    type: 'object',
    properties: {
      formId: { 
        type: 'string', 
        description: 'Specific form ID to test submit'
      },
      testData: { 
        type: 'object', 
        description: 'Test data to submit with the form (key-value pairs)'
      },
      useCurrentData: { 
        type: 'boolean', 
        description: 'Use current form data for submission test',
        default: true
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  react_hook_form_validation_analyze: {
    type: 'object',
    properties: {
      formId: { 
        type: 'string', 
        description: 'Specific form ID to analyze validation for'
      },
      includeSchemas: { 
        type: 'boolean', 
        description: 'Include validation schema information (Yup, Zod, etc.)',
        default: true
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  }
};