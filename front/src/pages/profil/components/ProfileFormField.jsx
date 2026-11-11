import { profileLabel } from "../profileTheme";
import { profileFieldEdit, profileFieldView, profileFieldViewEmpty } from "../profileFields";
import FormFieldError, { inputErrorStyle } from "../../../components/ui/FormFieldError";

export default function ProfileFormField({
  label,
  value,
  editing,
  onChange,
  placeholder,
  multiline,
  error,
  onBlur,
  type = "text",
}) {
  const empty = !String(value || "").trim();

  if (!editing) {
    return (
      <div>
        <span className={profileLabel}>{label}</span>
        <div className={empty ? profileFieldViewEmpty : profileFieldView}>
          {empty ? placeholder || "Non renseigné" : value}
        </div>
      </div>
    );
  }

  const fieldClass = `${profileFieldEdit} profile-slide-in`;

  if (multiline) {
    return (
      <div className="profile-slide-in">
        <label className={profileLabel}>{label}</label>
        <textarea
          rows={3}
          className={`${fieldClass} resize-none`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          style={error ? inputErrorStyle : undefined}
        />
        <FormFieldError message={error} />
      </div>
    );
  }

  return (
    <div className="profile-slide-in">
      <label className={profileLabel}>{label}</label>
      <input
        type={type}
        className={fieldClass}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        style={error ? inputErrorStyle : undefined}
      />
      <FormFieldError message={error} />
    </div>
  );
}
