// DI tokens kept in a leaf module (no imports) so providers can depend on them without a
// circular import back to the module that registers them.
export const ORG_CONFIG = 'ORG_CONFIG';
