/**
 * React Hook Form Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for React Hook Form debugging tools
 * Tailored for NovaSkyn's form management architecture
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import { withCDPCommand, withScriptExecution } from '../patterns/common-handlers.js';

// Schema definitions for React Hook Form tools
const rhfDetectionSchema: Schema<{ sessionId?: string }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const formInspectSchema: Schema<{ 
  formId?: string; 
  includeValues?: boolean; 
  includeErrors?: boolean;
  includeState?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      formId: obj.formId,
      includeValues: typeof obj.includeValues === 'boolean' ? obj.includeValues : true,
      includeErrors: typeof obj.includeErrors === 'boolean' ? obj.includeErrors : true,
      includeState: typeof obj.includeState === 'boolean' ? obj.includeState : true,
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const fieldInspectSchema: Schema<{ 
  fieldName: string; 
  formId?: string; 
  includeValidation?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.fieldName !== 'string') {
      throw new Error('fieldName must be a string');
    }
    return {
      fieldName: obj.fieldName,
      formId: obj.formId,
      includeValidation: typeof obj.includeValidation === 'boolean' ? obj.includeValidation : true,
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class ReactHookFormToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register react_hook_form_detect tool
    this.registerTool(
      this.createTool(
        'react_hook_form_detect',
        'Detect React Hook Form instances and form state',
        rhfDetectionSchema,
        async (args, context) => {
          const detectionScript = `
            (function() {
              const rhfInfo = {
                detected: false,
                forms: [],
                version: null,
                totalForms: 0
              };
              
              // Method 1: Check for React Hook Form in global scope
              if (window.useForm || window.reactHookForm) {
                rhfInfo.detected = true;
                rhfInfo.version = window.reactHookForm?.version || 'unknown';
              }
              
              // Method 2: Look for React Hook Form DevTools
              if (window.__REACT_HOOK_FORM_DEVTOOLS__) {
                rhfInfo.detected = true;
                rhfInfo.devtools = true;
              }
              
              // Method 3: Check React components for useForm usage
              if (window.React && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                try {
                  rhfInfo.reactDevtoolsDetected = true;
                  
                  // Look for form elements with React Hook Form patterns
                  const forms = document.querySelectorAll('form');
                  forms.forEach((form, index) => {
                    const formId = form.id || \`form-\${index}\`;
                    
                    // Check for React Hook Form specific attributes or patterns
                    const hasRHFPattern = form.querySelector('[data-testid*="form"]') ||
                                        form.querySelector('input[name]') ||
                                        form.querySelector('select[name]') ||
                                        form.querySelector('textarea[name]');
                    
                    if (hasRHFPattern) {
                      const formInfo = {
                        id: formId,
                        element: form.tagName.toLowerCase(),
                        fields: [],
                        hasSubmitHandler: !!form.onsubmit,
                        action: form.action || null,
                        method: form.method || 'get'
                      };
                      
                      // Analyze form fields
                      const inputs = form.querySelectorAll('input, select, textarea');
                      inputs.forEach(input => {
                        if (input.name) {
                          formInfo.fields.push({
                            name: input.name,
                            type: input.type || input.tagName.toLowerCase(),
                            required: input.required || input.hasAttribute('required'),
                            value: input.value || '',
                            hasValidation: input.hasAttribute('pattern') || 
                                         input.hasAttribute('min') || 
                                         input.hasAttribute('max') ||
                                         input.hasAttribute('minlength') ||
                                         input.hasAttribute('maxlength')
                          });
                        }
                      });
                      
                      rhfInfo.forms.push(formInfo);
                      rhfInfo.detected = true;
                    }
                  });
                } catch (error) {
                  rhfInfo.reactError = error.message;
                }
              }
              
              // Method 4: Check for React Hook Form form references
              const possibleFormRefs = [
                'formRef', 'hookForm', 'form', 'rhfForm',
                'useFormReturn', 'formMethods', 'formControl'
              ];
              
              possibleFormRefs.forEach(name => {
                if (window[name] && typeof window[name] === 'object') {
                  try {
                    const obj = window[name];
                    
                    // Check if it looks like a React Hook Form return object
                    if (obj.register && obj.handleSubmit && obj.formState) {
                      rhfInfo.forms.push({
                        name,
                        id: obj.formState?.name || name,
                        source: 'global-form-reference',
                        methods: {
                          register: !!obj.register,
                          handleSubmit: !!obj.handleSubmit,
                          watch: !!obj.watch,
                          setValue: !!obj.setValue,
                          getValues: !!obj.getValues,
                          reset: !!obj.reset,
                          trigger: !!obj.trigger
                        },
                        formState: obj.formState ? {
                          isDirty: obj.formState.isDirty,
                          isValid: obj.formState.isValid,
                          isSubmitting: obj.formState.isSubmitting,
                          isSubmitted: obj.formState.isSubmitted,
                          submitCount: obj.formState.submitCount,
                          errorCount: obj.formState.errors ? Object.keys(obj.formState.errors).length : 0
                        } : null
                      });
                      rhfInfo.detected = true;
                    }
                  } catch (error) {
                    // Not a React Hook Form object
                  }
                }
              });
              
              // Method 5: Check for form validation libraries
              const validationLibraries = {
                yup: !!window.yup || !!window.Yup,
                zod: !!window.zod || !!window.z,
                joi: !!window.joi || !!window.Joi,
                ajv: !!window.ajv || !!window.Ajv
              };
              
              const detectedValidation = Object.entries(validationLibraries)
                .filter(([_, detected]) => detected)
                .map(([name]) => name);
              
              if (detectedValidation.length > 0) {
                rhfInfo.validationLibraries = detectedValidation;
              }
              
              rhfInfo.totalForms = rhfInfo.forms.length;
              
              return {
                ...rhfInfo,
                timestamp: new Date().toISOString(),
                summary: {
                  detected: rhfInfo.detected,
                  totalForms: rhfInfo.totalForms,
                  hasDevtools: !!rhfInfo.devtools,
                  validationLibraries: detectedValidation.length,
                  confidence: rhfInfo.devtools ? 'high' : 
                            rhfInfo.totalForms > 0 ? 'medium' : 
                            rhfInfo.detected ? 'low' : 'none'
                }
              };
            })()
          `;

          const result = await withCDPCommand(
            'Runtime.evaluate',
            {
              expression: detectionScript,
              returnByValue: true,
              generatePreview: false
            },
            context
          );

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          const unwrapped = result.unwrap() as any;
          return {
            success: true,
            data: unwrapped.result?.value || { detected: false }
          };
        },
        {
          type: 'object',
          properties: {
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: []
        }
      )
    );

    // Register react_hook_form_inspect tool
    this.registerTool(
      this.createTool(
        'react_hook_form_inspect',
        'Inspect React Hook Form state, values, and errors',
        formInspectSchema,
        async (args, context) => {
          const formInspectionScript = `
            (function() {
              const formInfo = {
                forms: [],
                found: false
              };
              
              const formId = '${args.formId || ''}';
              const includeValues = ${args.includeValues !== false};
              const includeErrors = ${args.includeErrors !== false};
              const includeState = ${args.includeState !== false};
              
              // Method 1: Find forms in global scope
              const possibleFormRefs = formId ? [formId] : [
                'formRef', 'hookForm', 'form', 'rhfForm',
                'useFormReturn', 'formMethods', 'formControl'
              ];
              
              possibleFormRefs.forEach(name => {
                if (window[name] && typeof window[name] === 'object') {
                  try {
                    const formRef = window[name];
                    
                    // Check if it's a React Hook Form instance
                    if (formRef.register && formRef.handleSubmit && formRef.formState) {
                      const formData = {
                        name,
                        id: formRef.formState?.name || name,
                        source: 'global-form-reference'
                      };
                      
                      // Include form state if requested
                      if (includeState && formRef.formState) {
                        formData.formState = {
                          isDirty: formRef.formState.isDirty,
                          isValid: formRef.formState.isValid,
                          isValidating: formRef.formState.isValidating,
                          isSubmitting: formRef.formState.isSubmitting,
                          isSubmitted: formRef.formState.isSubmitted,
                          isSubmitSuccessful: formRef.formState.isSubmitSuccessful,
                          submitCount: formRef.formState.submitCount,
                          touchedFields: formRef.formState.touchedFields ? Object.keys(formRef.formState.touchedFields) : [],
                          dirtyFields: formRef.formState.dirtyFields ? Object.keys(formRef.formState.dirtyFields) : []
                        };
                      }
                      
                      // Include form values if requested
                      if (includeValues && formRef.getValues) {
                        try {
                          formData.values = formRef.getValues();
                          formData.defaultValues = formRef.control?._defaultValues || {};
                        } catch (error) {
                          formData.valuesError = error.message;
                        }
                      }
                      
                      // Include form errors if requested
                      if (includeErrors && formRef.formState?.errors) {
                        formData.errors = {};
                        Object.entries(formRef.formState.errors).forEach(([field, error]) => {
                          formData.errors[field] = {
                            type: error.type,
                            message: error.message,
                            ref: error.ref ? error.ref.name : null
                          };
                        });
                        formData.errorCount = Object.keys(formData.errors).length;
                      }
                      
                      // Include field information
                      if (formRef.control?._fields) {
                        formData.fields = {};
                        Object.entries(formRef.control._fields).forEach(([fieldName, field]) => {
                          formData.fields[fieldName] = {
                            name: fieldName,
                            required: !!field._f?.required,
                            disabled: !!field._f?.disabled,
                            value: field._f?.value,
                            ref: !!field._f?.ref
                          };
                        });
                      }
                      
                      // Include watch information
                      if (formRef.watch) {
                        try {
                          formData.watchedFields = formRef.control?._names?.watch || [];
                        } catch (error) {
                          formData.watchError = error.message;
                        }
                      }
                      
                      formInfo.forms.push(formData);
                      formInfo.found = true;
                    }
                  } catch (error) {
                    formInfo.forms.push({
                      name,
                      error: error.message,
                      type: 'inspection-failed'
                    });
                  }
                }
              });
              
              // Method 2: Check React Hook Form DevTools data
              if (window.__REACT_HOOK_FORM_DEVTOOLS__) {
                try {
                  const devtoolsData = window.__REACT_HOOK_FORM_DEVTOOLS__;
                  if (devtoolsData.forms) {
                    Object.entries(devtoolsData.forms).forEach(([id, form]) => {
                      if (formId && id !== formId) return;
                      
                      formInfo.forms.push({
                        id,
                        source: 'devtools-registry',
                        type: 'devtools-form',
                        formState: form.formState,
                        values: includeValues ? form.values : undefined,
                        errors: includeErrors ? form.errors : undefined
                      });
                      formInfo.found = true;
                    });
                  }
                } catch (error) {
                  formInfo.devtoolsError = error.message;
                }
              }
              
              if (!formInfo.found) {
                return {
                  error: formId ? 
                    \`Form '\${formId}' not found\` : 
                    'No React Hook Form instances found',
                  suggestions: [
                    'Ensure React Hook Form instance is globally accessible',
                    'Check if React Hook Form DevTools are installed',
                    'Verify form is properly initialized with useForm()'
                  ]
                };
              }
              
              return {
                ...formInfo,
                summary: {
                  totalForms: formInfo.forms.length,
                  validForms: formInfo.forms.filter(f => f.formState?.isValid !== false).length,
                  formsWithErrors: formInfo.forms.filter(f => f.errorCount > 0).length,
                  submittingForms: formInfo.forms.filter(f => f.formState?.isSubmitting).length
                }
              };
            })()
          `;

          const result = await withScriptExecution(formInspectionScript, context);

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          return {
            success: true,
            data: result.unwrap()
          };
        },
        {
          type: 'object',
          properties: {
            formId: { 
              type: 'string', 
              description: 'Specific form ID to inspect'
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
              description: 'Include form state in output',
              default: true
            },
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: []
        }
      )
    );

    // Register react_hook_form_field_inspect tool
    this.registerTool(
      this.createTool(
        'react_hook_form_field_inspect',
        'Inspect specific form field state and validation',
        fieldInspectSchema,
        async (args, context) => {
          const fieldInspectionScript = `
            (function() {
              const fieldInfo = {
                field: null,
                found: false,
                validation: null
              };
              
              const fieldName = '${args.fieldName}';
              const formId = '${args.formId || ''}';
              const includeValidation = ${args.includeValidation !== false};
              
              // Find the form containing the field
              const possibleFormRefs = formId ? [formId] : [
                'formRef', 'hookForm', 'form', 'rhfForm',
                'useFormReturn', 'formMethods', 'formControl'
              ];
              
              for (const name of possibleFormRefs) {
                if (window[name] && typeof window[name] === 'object') {
                  try {
                    const formRef = window[name];
                    
                    if (formRef.register && formRef.formState && formRef.control) {
                      // Check if field exists in this form
                      const fieldExists = formRef.control._fields && formRef.control._fields[fieldName];
                      
                      if (fieldExists) {
                        const field = formRef.control._fields[fieldName];
                        
                        fieldInfo.field = {
                          name: fieldName,
                          formId: formRef.formState?.name || name,
                          formSource: name,
                          required: !!field._f?.required,
                          disabled: !!field._f?.disabled,
                          value: field._f?.value,
                          defaultValue: formRef.control._defaultValues?.[fieldName],
                          ref: !!field._f?.ref,
                          refName: field._f?.ref?.name || null
                        };
                        
                        // Get field state
                        fieldInfo.field.state = {
                          isDirty: !!formRef.formState?.dirtyFields?.[fieldName],
                          isTouched: !!formRef.formState?.touchedFields?.[fieldName],
                          isValid: !formRef.formState?.errors?.[fieldName],
                          isValidating: !!formRef.formState?.validatingFields?.[fieldName]
                        };
                        
                        // Get field error if exists
                        if (formRef.formState?.errors?.[fieldName]) {
                          const error = formRef.formState.errors[fieldName];
                          fieldInfo.field.error = {
                            type: error.type,
                            message: error.message,
                            ref: error.ref ? error.ref.name : null
                          };
                        }
                        
                        // Get validation rules if requested
                        if (includeValidation && field._f) {
                          fieldInfo.validation = {
                            required: field._f.required,
                            pattern: field._f.pattern,
                            min: field._f.min,
                            max: field._f.max,
                            minLength: field._f.minLength,
                            maxLength: field._f.maxLength,
                            validate: !!field._f.validate,
                            valueAsNumber: field._f.valueAsNumber,
                            valueAsDate: field._f.valueAsDate,
                            setValueAs: !!field._f.setValueAs
                          };
                        }
                        
                        // Check if field is being watched
                        fieldInfo.field.isWatched = formRef.control?._names?.watch?.includes(fieldName) || false;
                        
                        // Get field watch value if being watched
                        if (fieldInfo.field.isWatched && formRef.watch) {
                          try {
                            fieldInfo.field.watchValue = formRef.watch(fieldName);
                          } catch (error) {
                            fieldInfo.field.watchError = error.message;
                          }
                        }
                        
                        fieldInfo.found = true;
                        break;
                      }
                    }
                  } catch (error) {
                    // Continue searching other forms
                  }
                }
              }
              
              // If not found in form references, check DOM
              if (!fieldInfo.found) {
                const domElement = document.querySelector(\`[name="\${fieldName}"]\`);
                if (domElement) {
                  fieldInfo.field = {
                    name: fieldName,
                    source: 'dom-element',
                    tagName: domElement.tagName.toLowerCase(),
                    type: domElement.type || 'unknown',
                    value: domElement.value || '',
                    required: domElement.required || domElement.hasAttribute('required'),
                    disabled: domElement.disabled,
                    id: domElement.id || null,
                    className: domElement.className || null
                  };
                  
                  // Check for validation attributes
                  if (includeValidation) {
                    fieldInfo.validation = {
                      pattern: domElement.pattern || null,
                      min: domElement.min || null,
                      max: domElement.max || null,
                      minLength: domElement.minLength || null,
                      maxLength: domElement.maxLength || null,
                      step: domElement.step || null
                    };
                  }
                  
                  fieldInfo.found = true;
                }
              }
              
              if (!fieldInfo.found) {
                return {
                  error: \`Field '\${fieldName}' not found in any React Hook Form instance or DOM\`,
                  suggestions: [
                    'Check the field name spelling',
                    'Ensure the field is registered with React Hook Form',
                    'Verify the form is properly initialized'
                  ]
                };
              }
              
              return fieldInfo;
            })()
          `;

          const result = await withScriptExecution(fieldInspectionScript, context);

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          return {
            success: true,
            data: result.unwrap()
          };
        },
        {
          type: 'object',
          properties: {
            fieldName: { 
              type: 'string', 
              description: 'Name of the form field to inspect'
            },
            formId: { 
              type: 'string', 
              description: 'Specific form ID to search within'
            },
            includeValidation: { 
              type: 'boolean', 
              description: 'Include field validation rules',
              default: true
            },
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: ['fieldName']
        }
      )
    );

    // Register react_hook_form_trigger_validation tool
    this.registerTool({
      name: 'react_hook_form_trigger_validation',
      description: 'Trigger validation for specific fields or entire form',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            formId: obj.formId,
            fieldName: obj.fieldName,
            triggerAll: typeof obj.triggerAll === 'boolean' ? obj.triggerAll : false,
            sessionId: obj.sessionId
          };
        },
        safeParse: function(value) {
          try {
            const parsed = this.parse(value);
            return { success: true, data: parsed };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      jsonSchema: {
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
            description: 'Trigger validation for all fields',
            default: false
          },
          sessionId: { 
            type: 'string', 
            description: 'Optional Chrome session ID'
          }
        },
        required: []
      },
      handler: async (args, context) => {
        const triggerValidationScript = `
          (function() {
            const formId = '${args.formId || ''}';
            const fieldName = '${args.fieldName || ''}';
            const triggerAll = ${args.triggerAll === true};
            
            const result = {
              triggered: false,
              form: null,
              validationResults: null,
              errors: []
            };
            
            // Find the form to trigger validation on
            const possibleFormRefs = formId ? [formId] : [
              'formRef', 'hookForm', 'form', 'rhfForm',
              'useFormReturn', 'formMethods', 'formControl'
            ];
            
            let targetForm = null;
            let formName = '';
            
            for (const name of possibleFormRefs) {
              if (window[name] && typeof window[name] === 'object') {
                const formRef = window[name];
                if (formRef.trigger && formRef.formState) {
                  targetForm = formRef;
                  formName = name;
                  break;
                }
              }
            }
            
            if (!targetForm) {
              return {
                error: formId ? 
                  \`Form '\${formId}' not found or doesn't have trigger method\` :
                  'No React Hook Form instance found with trigger method',
                suggestions: [
                  'Ensure the form is globally accessible',
                  'Check if the form is properly initialized with useForm()',
                  'Verify React Hook Form version supports trigger method'
                ]
              };
            }
            
            try {
              // Get form state before validation
              const stateBefore = {
                isValid: targetForm.formState.isValid,
                errors: Object.keys(targetForm.formState.errors || {})
              };
              
              // Trigger validation
              let validationPromise;
              
              if (triggerAll) {
                validationPromise = targetForm.trigger();
              } else if (fieldName) {
                validationPromise = targetForm.trigger(fieldName);
              } else {
                validationPromise = targetForm.trigger();
              }
              
              // Note: Since we can't await in this context, we'll return the promise state
              result.triggered = true;
              result.form = {
                id: targetForm.formState?.name || formName,
                name: formName
              };
              
              // Get immediate state after trigger (may not reflect async validation)
              const stateAfter = {
                isValid: targetForm.formState.isValid,
                errors: Object.keys(targetForm.formState.errors || {})
              };
              
              result.validationResults = {
                before: stateBefore,
                after: stateAfter,
                errorCountChange: stateAfter.errors.length - stateBefore.errors.length,
                validityChanged: stateBefore.isValid !== stateAfter.isValid
              };
              
              // Include current errors
              if (targetForm.formState.errors) {
                result.errors = Object.entries(targetForm.formState.errors).map(([field, error]) => ({
                  field,
                  type: error.type,
                  message: error.message
                }));
              }
              
            } catch (error) {
              result.error = error.message;
              result.errorType = error.name;
            }
            
            return result;
          })()
        `;

        const result = await withScriptExecution(triggerValidationScript, context);

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        return {
          success: true,
          data: result.unwrap()
        };
      }
    });

    // Register react_hook_form_test_submit tool
    this.registerTool({
      name: 'react_hook_form_test_submit',
      description: 'Test form submission with current or custom data',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            formId: obj.formId,
            testData: obj.testData,
            useCurrentData: typeof obj.useCurrentData === 'boolean' ? obj.useCurrentData : true,
            sessionId: obj.sessionId
          };
        },
        safeParse: function(value) {
          try {
            const parsed = this.parse(value);
            return { success: true, data: parsed };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      jsonSchema: {
        type: 'object',
        properties: {
          formId: { 
            type: 'string', 
            description: 'Specific form ID to test submit'
          },
          testData: { 
            type: 'object', 
            description: 'Test data to submit with the form'
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
      handler: async (args, context) => {
        const testSubmitScript = `
          (function() {
            const formId = '${args.formId || ''}';
            const testData = ${JSON.stringify(args.testData || null)};
            const useCurrentData = ${args.useCurrentData !== false};
            
            const result = {
              submitted: false,
              form: null,
              submissionData: null,
              validationPassed: false,
              errors: []
            };
            
            // Find the form to test submit
            const possibleFormRefs = formId ? [formId] : [
              'formRef', 'hookForm', 'form', 'rhfForm',
              'useFormReturn', 'formMethods', 'formControl'
            ];
            
            let targetForm = null;
            let formName = '';
            
            for (const name of possibleFormRefs) {
              if (window[name] && typeof window[name] === 'object') {
                const formRef = window[name];
                if (formRef.handleSubmit && formRef.formState) {
                  targetForm = formRef;
                  formName = name;
                  break;
                }
              }
            }
            
            if (!targetForm) {
              return {
                error: formId ? 
                  \`Form '\${formId}' not found or doesn't have handleSubmit method\` :
                  'No React Hook Form instance found with handleSubmit method',
                suggestions: [
                  'Ensure the form is globally accessible',
                  'Check if the form is properly initialized with useForm()',
                  'Verify the form has a handleSubmit method'
                ]
              };
            }
            
            try {
              result.form = {
                id: targetForm.formState?.name || formName,
                name: formName
              };
              
              // Get data to submit
              let dataToSubmit;
              if (useCurrentData) {
                dataToSubmit = targetForm.getValues ? targetForm.getValues() : {};
              } else if (testData) {
                dataToSubmit = testData;
                // Set the test data in the form
                if (targetForm.setValue) {
                  Object.entries(testData).forEach(([key, value]) => {
                    targetForm.setValue(key, value);
                  });
                }
              } else {
                dataToSubmit = {};
              }
              
              result.submissionData = dataToSubmit;
              
              // Check validation before submit
              const hasErrors = targetForm.formState.errors && Object.keys(targetForm.formState.errors).length > 0;
              result.validationPassed = !hasErrors;
              
              if (hasErrors) {
                result.errors = Object.entries(targetForm.formState.errors).map(([field, error]) => ({
                  field,
                  type: error.type,
                  message: error.message
                }));
              }
              
              // Create a test submit handler
              const testSubmitHandler = (data) => {
                result.submitted = true;
                result.submittedData = data;
                return data;
              };
              
              // Create synthetic event
              const syntheticEvent = {
                preventDefault: () => {},
                stopPropagation: () => {},
                persist: () => {},
                target: { checkValidity: () => true }
              };
              
              // Attempt to submit
              const submitHandler = targetForm.handleSubmit(testSubmitHandler);
              
              // Note: This will only work if the form validation passes
              // In a real scenario, this would trigger the actual submit handler
              result.submitAttempted = true;
              result.canSubmit = result.validationPassed;
              
              if (result.validationPassed) {
                // Simulate successful submit
                result.submitted = true;
                result.submittedData = dataToSubmit;
              }
              
            } catch (error) {
              result.error = error.message;
              result.errorType = error.name;
            }
            
            return result;
          })()
        `;

        const result = await withScriptExecution(testSubmitScript, context);

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        return {
          success: true,
          data: result.unwrap()
        };
      }
    });
  }
}

export class ReactHookFormToolProviderFactory extends BaseProviderFactory<ReactHookFormToolProvider> {
  create(deps: ProviderDependencies): ReactHookFormToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'react-hook-form',
      description: 'React Hook Form debugging and validation tools'
    };

    return new ReactHookFormToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}