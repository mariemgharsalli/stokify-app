/** Classes CSS champs profil — évite le fond blanc en mode édition */

export const PROFILE_FIELD_CSS = `
  .profile-field {
    width: 100%;
    border-radius: 0.75rem;
    border: 1px solid var(--border-default);
    background: var(--bg-hover) !important;
    color: var(--text-primary) !important;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    line-height: 1.4;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    -webkit-text-fill-color: var(--text-primary);
  }
  .profile-field::placeholder {
    color: var(--text-placeholder);
    opacity: 1;
  }
  .profile-field--edit {
    background: color-mix(in srgb, var(--bg-input) 92%, rgba(55, 138, 221, 0.08)) !important;
    border-color: color-mix(in srgb, var(--border-default) 70%, rgba(55, 138, 221, 0.45));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }
  .dark .profile-field--edit {
    background: #141824 !important;
    border-color: rgba(55, 138, 221, 0.28);
  }
  .light .profile-field--edit {
    background: #f1f5f9 !important;
    border-color: rgba(55, 138, 221, 0.35);
  }
  .profile-field--edit:focus {
    outline: none;
    border-color: rgba(55, 138, 221, 0.65);
    box-shadow: 0 0 0 3px rgba(55, 138, 221, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
  .profile-field-view {
    border-radius: 0.75rem;
    border: 1px solid var(--border-subtle);
    background: var(--bg-hover);
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    color: var(--text-primary);
    min-height: 2.75rem;
  }
  .profile-field-view--empty {
    color: var(--text-muted);
    font-style: italic;
  }
  @keyframes profileShieldFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  @keyframes profileScanLine {
    0% { transform: translateY(-100%); opacity: 0; }
    15% { opacity: 0.6; }
    100% { transform: translateY(400%); opacity: 0; }
  }
  @keyframes profileCheckPop {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  @keyframes profileMeterFill {
    from { width: 0; }
  }
  .profile-shield-float { animation: profileShieldFloat 3s ease-in-out infinite; }
  .profile-scan-line {
    animation: profileScanLine 3s ease-in-out infinite;
  }
  .profile-check-pop { animation: profileCheckPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .profile-meter-seg { animation: profileMeterFill 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
`;

export const profileFieldEdit = "profile-field profile-field--edit";
export const profileFieldView = "profile-field-view";
export const profileFieldViewEmpty = "profile-field-view profile-field-view--empty";
