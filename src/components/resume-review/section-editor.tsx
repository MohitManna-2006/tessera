"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  ResumeEducationV1Schema,
  ResumeExperienceV1Schema,
  ResumeProfileV1Schema,
  ResumeProjectV1Schema,
  ResumeSkillV1Schema,
  type DraftFieldKey,
  type DraftFieldReferenceV1,
  type PartialDateV1,
  type ResumeEducationV1,
  type ResumeExperienceV1,
  type ResumePortfolioDraftDataV1,
  type ResumeProfileV1,
  type ResumeProjectV1,
  type ResumeReviewSection,
  type ResumeSkillV1,
  type ResumeWarningV1,
} from "@/lib/resume-draft/contracts";
import type { ResumeDraftChange } from "@/lib/resume-review/review-model";

type EditorProps = {
  data: ResumePortfolioDraftDataV1;
  section: ResumeReviewSection;
  warnings: readonly ResumeWarningV1[];
  needsReviewOnly: boolean;
  editRequest: { entryId: string | null } | null;
  onConsumeEditRequest: () => void;
  onChange: (
    data: ResumePortfolioDraftDataV1,
    change: ResumeDraftChange,
  ) => void;
  onViewSource: (target: DraftFieldReferenceV1) => void;
  hasEvidence: (target: DraftFieldReferenceV1) => boolean;
};

function newId(
  prefix:
    | "link"
    | "experience"
    | "achievement"
    | "project"
    | "technology"
    | "skill"
    | "education"
    | "honor",
): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function reference(
  section: ResumeReviewSection,
  field: DraftFieldKey,
  entryId: string | null = null,
  itemId: string | null = null,
): DraftFieldReferenceV1 {
  return { section, field, entryId, itemId };
}

function SourceButton({
  target,
  hasEvidence,
  onViewSource,
}: {
  target: DraftFieldReferenceV1;
  hasEvidence: EditorProps["hasEvidence"];
  onViewSource: EditorProps["onViewSource"];
}) {
  if (!hasEvidence(target)) return null;
  return (
    <button
      className="review-source-button"
      type="button"
      onClick={() => onViewSource(target)}
    >
      View source
    </button>
  );
}

function ValueRow({
  label,
  children,
  target,
  hasEvidence,
  onViewSource,
}: {
  label: string;
  children: ReactNode;
  target: DraftFieldReferenceV1;
  hasEvidence: EditorProps["hasEvidence"];
  onViewSource: EditorProps["onViewSource"];
}) {
  return (
    <div className="review-value-row">
      <div>
        <span>{label}</span>
        <p>{children || "Not provided"}</p>
      </div>
      <SourceButton
        target={target}
        hasEvidence={hasEvidence}
        onViewSource={onViewSource}
      />
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="review-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function dateInputValue(value: PartialDateV1 | null): string {
  if (value === null) return "";
  return value.month === null
    ? String(value.year)
    : `${value.year}-${String(value.month).padStart(2, "0")}`;
}

function parsePartialDate(value: string): PartialDateV1 | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})(?:-(\d{2}))?$/u.exec(trimmed);
  if (!match) throw new Error("Use YYYY or YYYY-MM for dates.");
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : null;
  if (
    year < 1900 ||
    year > 2100 ||
    (month !== null && (month < 1 || month > 12))
  ) {
    throw new Error("Enter a date between 1900 and 2100 with a valid month.");
  }
  return {
    precision: month === null ? "year" : "month",
    year,
    month,
    sourceText: trimmed,
  };
}

function formatDate(value: PartialDateV1 | null): string {
  if (value === null) return "Date not provided";
  if (value.month === null) return String(value.year);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(value.year, value.month - 1, 1)));
}

function isDateAfter(
  start: PartialDateV1 | null,
  end: PartialDateV1 | null,
): boolean {
  if (start === null || end === null) return false;
  if (start.year !== end.year) return start.year > end.year;
  if (start.month === null || end.month === null) return false;
  return start.month > end.month;
}

function dateRange(
  start: PartialDateV1 | null,
  end: PartialDateV1 | null,
  current = false,
): string {
  return `${formatDate(start)} – ${current ? "Present" : formatDate(end)}`;
}

function warningCount(
  warnings: readonly ResumeWarningV1[],
  entryId: string | null,
): number {
  return warnings.filter((warning) =>
    entryId === null
      ? warning.target?.entryId === null || warning.target === null
      : warning.target?.entryId === entryId,
  ).length;
}

function CardHeader({
  title,
  subtitle,
  warnings,
}: {
  title: string;
  subtitle?: string;
  warnings: number;
}) {
  return (
    <div className="review-card-heading">
      <div>
        <h3>{title || "Untitled entry"}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {warnings > 0 ? (
        <span className="review-warning-marker">Needs review · {warnings}</span>
      ) : null}
    </div>
  );
}

function EditorActions({
  adding,
  onCancel,
}: {
  adding: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="review-editor-actions">
      <button className="resume-primary-button" type="submit">
        {adding ? "Add entry" : "Save changes"}
      </button>
      <button
        className="resume-secondary-button"
        type="button"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}

function useFormError() {
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  return { error, setError, errorRef };
}

function ProfileEditor(props: EditorProps) {
  const [editing, setEditing] = useState(props.editRequest !== null);
  const [form, setForm] = useState<ResumeProfileV1>(props.data.profile);
  const { error, setError, errorRef } = useFormError();

  const startEdit = () => {
    setForm(structuredClone(props.data.profile));
    setError(null);
    setEditing(true);
  };

  if (!editing) {
    const profile = props.data.profile;
    return (
      <article className="review-entry-card">
        <CardHeader
          title={profile.name ?? "Name not provided"}
          subtitle={profile.sourceTitle ?? undefined}
          warnings={warningCount(props.warnings, null)}
        />
        <div className="review-value-list">
          <ValueRow
            label="Broad location"
            target={reference("profile", "profile.location")}
            {...props}
          >
            {profile.location}
          </ValueRow>
          <ValueRow
            label="Private email"
            target={reference("profile", "profile.email")}
            {...props}
          >
            {profile.email}
          </ValueRow>
          <ValueRow
            label="Private phone"
            target={reference("profile", "profile.phone")}
            {...props}
          >
            {profile.phone}
          </ValueRow>
        </div>
        {profile.links.length > 0 ? (
          <div className="review-inline-list" aria-label="Profile links">
            {profile.links.map((link) => (
              <span key={link.id}>{link.label}</span>
            ))}
          </div>
        ) : null}
        <p className="review-privacy-note">
          Contact details and links remain private by default. Public visibility
          is not decided in this review.
        </p>
        <div className="review-card-actions">
          <button
            className="resume-secondary-button"
            type="button"
            onClick={startEdit}
          >
            Edit profile
          </button>
          <SourceButton
            target={reference("profile", "profile.name")}
            {...props}
          />
        </div>
      </article>
    );
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }
    const parsed = ResumeProfileV1Schema.safeParse(form);
    if (!parsed.success) {
      setError("Review the highlighted profile fields and safe link URLs.");
      return;
    }
    if (JSON.stringify(parsed.data) !== JSON.stringify(props.data.profile)) {
      const changedFields: DraftFieldReferenceV1[] = [
        reference("profile", "profile.name"),
        reference("profile", "profile.sourceTitle"),
        reference("profile", "profile.location"),
        reference("profile", "profile.email"),
        reference("profile", "profile.phone"),
        ...parsed.data.links.flatMap((link) => [
          reference("profile", "profile.links.label", link.id),
          reference("profile", "profile.links.url", link.id),
          reference("profile", "profile.links.kind", link.id),
        ]),
      ];
      const next = structuredClone(props.data);
      next.profile = parsed.data;
      const previousLinkIds = new Set(
        props.data.profile.links.map((link) => link.id),
      );
      props.onChange(next, {
        section: "profile",
        changedFields,
        enteredFields: changedFields.filter(
          (target) =>
            target.entryId !== null && !previousLinkIds.has(target.entryId),
        ),
        removedEntryIds: props.data.profile.links
          .filter(
            (link) =>
              !parsed.data.links.some((nextLink) => nextLink.id === link.id),
          )
          .map((link) => link.id),
      });
    }
    setEditing(false);
    if (props.editRequest) props.onConsumeEditRequest();
  };

  return (
    <form className="review-edit-form" onSubmit={submit}>
      {error ? (
        <div
          ref={errorRef}
          className="review-form-error"
          role="alert"
          tabIndex={-1}
        >
          {error}
        </div>
      ) : null}
      <div className="review-field-grid">
        <Field label="Name">
          <input
            autoFocus
            required
            value={form.name ?? ""}
            maxLength={160}
            onChange={(event) =>
              setForm({ ...form, name: event.target.value || null })
            }
          />
        </Field>
        <Field
          label="Resume title"
          hint="Kept as source wording, not a headline."
        >
          <input
            value={form.sourceTitle ?? ""}
            maxLength={200}
            onChange={(event) =>
              setForm({ ...form, sourceTitle: event.target.value || null })
            }
          />
        </Field>
        <Field label="Broad location">
          <input
            value={form.location ?? ""}
            maxLength={200}
            onChange={(event) =>
              setForm({ ...form, location: event.target.value || null })
            }
          />
        </Field>
        <Field label="Private email">
          <input
            type="email"
            value={form.email ?? ""}
            maxLength={254}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value || null })
            }
          />
        </Field>
        <Field label="Private phone">
          <input
            type="tel"
            value={form.phone ?? ""}
            maxLength={40}
            onChange={(event) =>
              setForm({ ...form, phone: event.target.value || null })
            }
          />
        </Field>
      </div>
      <fieldset className="review-list-editor">
        <legend>Links</legend>
        {form.links.map((link, index) => (
          <div className="review-list-edit-row" key={link.id}>
            <Field label={`Link ${index + 1} label`}>
              <input
                required
                value={link.label}
                maxLength={100}
                onChange={(event) =>
                  setForm({
                    ...form,
                    links: form.links.map((item) =>
                      item.id === link.id
                        ? { ...item, label: event.target.value }
                        : item,
                    ),
                  })
                }
              />
            </Field>
            <Field label={`Link ${index + 1} URL`}>
              <input
                required
                type="url"
                value={link.url}
                maxLength={2048}
                onChange={(event) =>
                  setForm({
                    ...form,
                    links: form.links.map((item) =>
                      item.id === link.id
                        ? { ...item, url: event.target.value }
                        : item,
                    ),
                  })
                }
              />
            </Field>
            <Field label={`Link ${index + 1} type`}>
              <select
                value={link.kind}
                onChange={(event) =>
                  setForm({
                    ...form,
                    links: form.links.map((item) =>
                      item.id === link.id
                        ? {
                            ...item,
                            kind: event.target.value as typeof link.kind,
                          }
                        : item,
                    ),
                  })
                }
              >
                <option value="github">GitHub</option>
                <option value="linkedin">LinkedIn</option>
                <option value="personal">Personal</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <button
              className="review-remove-button"
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  links: form.links.filter((item) => item.id !== link.id),
                })
              }
            >
              Remove link {index + 1}
            </button>
          </div>
        ))}
        <button
          className="review-add-button"
          type="button"
          onClick={() =>
            setForm({
              ...form,
              links: [
                ...form.links,
                {
                  id: newId("link"),
                  label: "",
                  url: "",
                  kind: "other",
                  public: false,
                },
              ],
            })
          }
        >
          Add link
        </button>
      </fieldset>
      <EditorActions
        adding={false}
        onCancel={() => {
          setEditing(false);
          setError(null);
          if (props.editRequest) props.onConsumeEditRequest();
        }}
      />
    </form>
  );
}

function ExperienceForm({
  entry,
  adding,
  onCancel,
  onSave,
}: {
  entry: ResumeExperienceV1;
  adding: boolean;
  onCancel: () => void;
  onSave: (entry: ResumeExperienceV1) => void;
}) {
  const [form, setForm] = useState(structuredClone(entry));
  const [startDate, setStartDate] = useState(dateInputValue(entry.startDate));
  const [endDate, setEndDate] = useState(dateInputValue(entry.endDate));
  const { error, setError, errorRef } = useFormError();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const nextStartDate = parsePartialDate(startDate);
      const nextEndDate = form.current ? null : parsePartialDate(endDate);
      if (isDateAfter(nextStartDate, nextEndDate)) {
        setError("The end date cannot be before the start date.");
        return;
      }
      const parsed = ResumeExperienceV1Schema.safeParse({
        ...form,
        startDate: nextStartDate,
        endDate: nextEndDate,
      });
      if (!parsed.success) {
        setError("Review this experience’s fields and date values.");
        return;
      }
      onSave(parsed.data);
    } catch (dateError) {
      setError(
        dateError instanceof Error ? dateError.message : "Review the dates.",
      );
    }
  };

  return (
    <form className="review-edit-form" onSubmit={submit}>
      {error ? (
        <div
          ref={errorRef}
          className="review-form-error"
          role="alert"
          tabIndex={-1}
        >
          {error}
        </div>
      ) : null}
      <div className="review-field-grid">
        <Field label="Employer">
          <input
            autoFocus
            required
            value={form.company ?? ""}
            maxLength={200}
            onChange={(event) =>
              setForm({ ...form, company: event.target.value || null })
            }
          />
        </Field>
        <Field label="Role">
          <input
            required
            value={form.role ?? ""}
            maxLength={200}
            onChange={(event) =>
              setForm({ ...form, role: event.target.value || null })
            }
          />
        </Field>
        <Field label="Broad location">
          <input
            value={form.location ?? ""}
            maxLength={200}
            onChange={(event) =>
              setForm({ ...form, location: event.target.value || null })
            }
          />
        </Field>
        <Field label="Employment type">
          <input
            value={form.employmentType ?? ""}
            maxLength={80}
            onChange={(event) =>
              setForm({ ...form, employmentType: event.target.value || null })
            }
          />
        </Field>
        <Field label="Start date" hint="Use YYYY or YYYY-MM.">
          <input
            inputMode="numeric"
            value={startDate}
            pattern="\d{4}(-\d{2})?"
            onChange={(event) => setStartDate(event.target.value)}
          />
        </Field>
        <Field label="End date" hint="Use YYYY or YYYY-MM.">
          <input
            inputMode="numeric"
            value={endDate}
            pattern="\d{4}(-\d{2})?"
            disabled={form.current}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </Field>
      </div>
      <label className="review-checkbox">
        <input
          type="checkbox"
          checked={form.current}
          onChange={(event) =>
            setForm({ ...form, current: event.target.checked })
          }
        />
        This is a current role
      </label>
      <fieldset className="review-list-editor">
        <legend>Achievements</legend>
        {form.achievements.map((achievement, index) => (
          <div
            className="review-list-edit-row review-list-edit-row-wide"
            key={achievement.id}
          >
            <Field label={`Achievement ${index + 1}`}>
              <textarea
                required
                rows={3}
                value={achievement.text}
                maxLength={1000}
                onChange={(event) =>
                  setForm({
                    ...form,
                    achievements: form.achievements.map((item) =>
                      item.id === achievement.id
                        ? { ...item, text: event.target.value }
                        : item,
                    ),
                  })
                }
              />
            </Field>
            <button
              className="review-remove-button"
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  achievements: form.achievements.filter(
                    (item) => item.id !== achievement.id,
                  ),
                })
              }
            >
              Remove achievement {index + 1}
            </button>
          </div>
        ))}
        <button
          className="review-add-button"
          type="button"
          onClick={() =>
            setForm({
              ...form,
              achievements: [
                ...form.achievements,
                { id: newId("achievement"), text: "" },
              ],
            })
          }
        >
          Add achievement
        </button>
      </fieldset>
      <EditorActions adding={adding} onCancel={onCancel} />
    </form>
  );
}

function ExperienceEditor(props: EditorProps) {
  const [editingId, setEditingId] = useState<string | null>(
    props.editRequest?.entryId ?? null,
  );
  const [adding, setAdding] = useState(false);

  const save = (entry: ResumeExperienceV1, isAdding: boolean) => {
    const previous = props.data.experience.find((item) => item.id === entry.id);
    if (!isAdding && JSON.stringify(previous) === JSON.stringify(entry)) {
      setEditingId(null);
      if (props.editRequest) props.onConsumeEditRequest();
      return;
    }
    const next = structuredClone(props.data);
    next.experience = isAdding
      ? [...next.experience, entry]
      : next.experience.map((item) => (item.id === entry.id ? entry : item));
    const changedFields = [
      "company",
      "role",
      "location",
      "employmentType",
      "startDate",
      "endDate",
      "current",
    ]
      .map((field) =>
        reference(
          "experience",
          `experience.${field}` as DraftFieldKey,
          entry.id,
        ),
      )
      .concat(
        entry.achievements.map((achievement) =>
          reference(
            "experience",
            "experience.achievements.text",
            entry.id,
            achievement.id,
          ),
        ),
      );
    const previousAchievementIds = new Set(
      previous?.achievements.map((item) => item.id) ?? [],
    );
    props.onChange(next, {
      section: "experience",
      provenance: isAdding ? "user_entered" : "user_edited",
      changedFields,
      enteredFields: changedFields.filter(
        (target) =>
          isAdding ||
          (target.itemId !== null &&
            !previousAchievementIds.has(target.itemId)),
      ),
      removedEntryIds: previous?.achievements
        .filter(
          (item) =>
            !entry.achievements.some(
              (achievement) => achievement.id === item.id,
            ),
        )
        .map((item) => item.id),
    });
    setEditingId(null);
    setAdding(false);
    if (props.editRequest) props.onConsumeEditRequest();
  };
  const cancelEdit = () => {
    setEditingId(null);
    if (props.editRequest) props.onConsumeEditRequest();
  };

  const visibleEntries = props.needsReviewOnly
    ? props.data.experience.filter((entry) =>
        props.warnings.some((warning) => warning.target?.entryId === entry.id),
      )
    : props.data.experience;

  return (
    <div className="review-entry-stack">
      {visibleEntries.map((entry) =>
        editingId === entry.id ? (
          <ExperienceForm
            key={entry.id}
            entry={entry}
            adding={false}
            onCancel={cancelEdit}
            onSave={(updated) => save(updated, false)}
          />
        ) : (
          <article className="review-entry-card" key={entry.id}>
            <CardHeader
              title={entry.company ?? "Employer not provided"}
              subtitle={entry.role ?? undefined}
              warnings={warningCount(props.warnings, entry.id)}
            />
            <p className="review-card-meta">
              {dateRange(entry.startDate, entry.endDate, entry.current)}
              {entry.location ? ` · ${entry.location}` : ""}
            </p>
            {entry.achievements.length > 0 ? (
              <ul className="review-bullet-list">
                {entry.achievements.map((achievement) => (
                  <li key={achievement.id}>
                    <span>{achievement.text}</span>
                    <SourceButton
                      target={reference(
                        "experience",
                        "experience.achievements.text",
                        entry.id,
                        achievement.id,
                      )}
                      {...props}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="review-empty-copy">No achievements provided.</p>
            )}
            <div className="review-card-actions">
              <button
                className="resume-secondary-button"
                type="button"
                onClick={() => setEditingId(entry.id)}
              >
                Edit
              </button>
              <SourceButton
                target={reference("experience", "experience.company", entry.id)}
                {...props}
              />
              <button
                className="review-remove-button"
                type="button"
                onClick={() => {
                  if (!window.confirm("Remove this experience entry?")) return;
                  const next = structuredClone(props.data);
                  next.experience = next.experience.filter(
                    (item) => item.id !== entry.id,
                  );
                  props.onChange(next, {
                    section: "experience",
                    changedFields: [],
                    removedEntryIds: [entry.id],
                  });
                }}
              >
                Remove
              </button>
            </div>
          </article>
        ),
      )}
      {adding ? (
        <ExperienceForm
          entry={{
            id: newId("experience"),
            company: null,
            role: null,
            location: null,
            employmentType: null,
            startDate: null,
            endDate: null,
            current: false,
            achievements: [],
          }}
          adding
          onCancel={() => setAdding(false)}
          onSave={(entry) => save(entry, true)}
        />
      ) : (
        <button
          className="review-add-button"
          type="button"
          onClick={() => setAdding(true)}
        >
          Add experience
        </button>
      )}
    </div>
  );
}

function ProjectForm({
  entry,
  adding,
  onCancel,
  onSave,
}: {
  entry: ResumeProjectV1;
  adding: boolean;
  onCancel: () => void;
  onSave: (entry: ResumeProjectV1) => void;
}) {
  const [form, setForm] = useState(structuredClone(entry));
  const [startDate, setStartDate] = useState(dateInputValue(entry.startDate));
  const [endDate, setEndDate] = useState(dateInputValue(entry.endDate));
  const { error, setError, errorRef } = useFormError();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }
    try {
      const nextStartDate = parsePartialDate(startDate);
      const nextEndDate = parsePartialDate(endDate);
      if (isDateAfter(nextStartDate, nextEndDate)) {
        setError("The end date cannot be before the start date.");
        return;
      }
      const parsed = ResumeProjectV1Schema.safeParse({
        ...form,
        startDate: nextStartDate,
        endDate: nextEndDate,
      });
      if (!parsed.success) {
        setError("Review this project’s fields, dates, and full safe URLs.");
        return;
      }
      onSave(parsed.data);
    } catch (dateError) {
      setError(
        dateError instanceof Error ? dateError.message : "Review the dates.",
      );
    }
  };
  return (
    <form className="review-edit-form" onSubmit={submit}>
      {error ? (
        <div
          ref={errorRef}
          className="review-form-error"
          role="alert"
          tabIndex={-1}
        >
          {error}
        </div>
      ) : null}
      <div className="review-field-grid">
        <Field label="Project name">
          <input
            autoFocus
            required
            value={form.name ?? ""}
            maxLength={200}
            onChange={(event) =>
              setForm({ ...form, name: event.target.value || null })
            }
          />
        </Field>
        <Field label="Your role">
          <input
            value={form.role ?? ""}
            maxLength={200}
            onChange={(event) =>
              setForm({ ...form, role: event.target.value || null })
            }
          />
        </Field>
        <Field label="Start date" hint="Use YYYY or YYYY-MM.">
          <input
            inputMode="numeric"
            pattern="\d{4}(-\d{2})?"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </Field>
        <Field label="End date" hint="Use YYYY or YYYY-MM.">
          <input
            inputMode="numeric"
            pattern="\d{4}(-\d{2})?"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </Field>
        <Field label="Repository URL">
          <input
            type="url"
            value={form.repositoryUrl ?? ""}
            onChange={(event) =>
              setForm({ ...form, repositoryUrl: event.target.value || null })
            }
          />
        </Field>
        <Field label="Live URL">
          <input
            type="url"
            value={form.liveUrl ?? ""}
            onChange={(event) =>
              setForm({ ...form, liveUrl: event.target.value || null })
            }
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          rows={5}
          value={form.description ?? ""}
          maxLength={2000}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value || null })
          }
        />
      </Field>
      <fieldset className="review-list-editor">
        <legend>Technologies</legend>
        {form.technologies.map((technology, index) => (
          <div
            className="review-list-edit-row review-list-edit-row-compact"
            key={technology.id}
          >
            <Field label={`Technology ${index + 1}`}>
              <input
                required
                value={technology.name}
                maxLength={100}
                onChange={(event) =>
                  setForm({
                    ...form,
                    technologies: form.technologies.map((item) =>
                      item.id === technology.id
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  })
                }
              />
            </Field>
            <button
              className="review-remove-button"
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  technologies: form.technologies.filter(
                    (item) => item.id !== technology.id,
                  ),
                })
              }
            >
              Remove technology {index + 1}
            </button>
          </div>
        ))}
        <button
          className="review-add-button"
          type="button"
          onClick={() =>
            setForm({
              ...form,
              technologies: [
                ...form.technologies,
                { id: newId("technology"), name: "" },
              ],
            })
          }
        >
          Add technology
        </button>
      </fieldset>
      <EditorActions adding={adding} onCancel={onCancel} />
    </form>
  );
}

function ProjectEditor(props: EditorProps) {
  const [editingId, setEditingId] = useState<string | null>(
    props.editRequest?.entryId ?? null,
  );
  const [adding, setAdding] = useState(false);

  const save = (entry: ResumeProjectV1, isAdding: boolean) => {
    const previous = props.data.projects.find((item) => item.id === entry.id);
    if (!isAdding && JSON.stringify(previous) === JSON.stringify(entry)) {
      setEditingId(null);
      if (props.editRequest) props.onConsumeEditRequest();
      return;
    }
    const next = structuredClone(props.data);
    next.projects = isAdding
      ? [...next.projects, entry]
      : next.projects.map((item) => (item.id === entry.id ? entry : item));
    const changedFields = [
      "name",
      "description",
      "role",
      "startDate",
      "endDate",
      "repositoryUrl",
      "liveUrl",
    ]
      .map((field) =>
        reference("projects", `projects.${field}` as DraftFieldKey, entry.id),
      )
      .concat(
        entry.technologies.map((technology) =>
          reference(
            "projects",
            "projects.technologies.name",
            entry.id,
            technology.id,
          ),
        ),
      );
    const previousTechnologyIds = new Set(
      previous?.technologies.map((item) => item.id) ?? [],
    );
    props.onChange(next, {
      section: "projects",
      provenance: isAdding ? "user_entered" : "user_edited",
      changedFields,
      enteredFields: changedFields.filter(
        (target) =>
          isAdding ||
          (target.itemId !== null && !previousTechnologyIds.has(target.itemId)),
      ),
      removedEntryIds: previous?.technologies
        .filter(
          (item) =>
            !entry.technologies.some((technology) => technology.id === item.id),
        )
        .map((item) => item.id),
    });
    setEditingId(null);
    setAdding(false);
    if (props.editRequest) props.onConsumeEditRequest();
  };
  const cancelEdit = () => {
    setEditingId(null);
    if (props.editRequest) props.onConsumeEditRequest();
  };
  const visible = props.needsReviewOnly
    ? props.data.projects.filter((entry) =>
        props.warnings.some((warning) => warning.target?.entryId === entry.id),
      )
    : props.data.projects;

  return (
    <div className="review-entry-stack">
      {visible.map((entry) =>
        editingId === entry.id ? (
          <ProjectForm
            key={entry.id}
            entry={entry}
            adding={false}
            onCancel={cancelEdit}
            onSave={(value) => save(value, false)}
          />
        ) : (
          <article className="review-entry-card" key={entry.id}>
            <CardHeader
              title={entry.name ?? "Project name not provided"}
              subtitle={entry.role ?? undefined}
              warnings={warningCount(props.warnings, entry.id)}
            />
            {entry.description ? (
              <p className="review-description">{entry.description}</p>
            ) : (
              <p className="review-empty-copy">No description provided.</p>
            )}
            {entry.technologies.length > 0 ? (
              <div className="review-inline-list" aria-label="Technologies">
                {entry.technologies.map((technology) => (
                  <span key={technology.id}>{technology.name}</span>
                ))}
              </div>
            ) : null}
            <p className="review-card-meta">
              {dateRange(entry.startDate, entry.endDate)}
            </p>
            <div className="review-card-actions">
              <button
                className="resume-secondary-button"
                type="button"
                onClick={() => setEditingId(entry.id)}
              >
                Edit
              </button>
              <SourceButton
                target={reference("projects", "projects.name", entry.id)}
                {...props}
              />
              <button
                className="review-remove-button"
                type="button"
                onClick={() => {
                  if (!window.confirm("Remove this project entry?")) return;
                  const next = structuredClone(props.data);
                  next.projects = next.projects.filter(
                    (item) => item.id !== entry.id,
                  );
                  props.onChange(next, {
                    section: "projects",
                    changedFields: [],
                    removedEntryIds: [entry.id],
                  });
                }}
              >
                Remove
              </button>
            </div>
          </article>
        ),
      )}
      {adding ? (
        <ProjectForm
          entry={{
            id: newId("project"),
            name: null,
            description: null,
            role: null,
            technologies: [],
            startDate: null,
            endDate: null,
            repositoryUrl: null,
            liveUrl: null,
          }}
          adding
          onCancel={() => setAdding(false)}
          onSave={(entry) => save(entry, true)}
        />
      ) : (
        <button
          className="review-add-button"
          type="button"
          onClick={() => setAdding(true)}
        >
          Add project
        </button>
      )}
    </div>
  );
}

function SkillForm({
  skill,
  adding,
  onCancel,
  onSave,
}: {
  skill: ResumeSkillV1;
  adding: boolean;
  onCancel: () => void;
  onSave: (skill: ResumeSkillV1) => void;
}) {
  const [form, setForm] = useState(skill);
  return (
    <form
      className="review-edit-form review-skill-form"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = ResumeSkillV1Schema.safeParse(form);
        if (parsed.success) onSave(parsed.data);
      }}
    >
      <div className="review-field-grid">
        <Field label="Skill">
          <input
            autoFocus
            required
            value={form.name}
            maxLength={100}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="Group">
          <input
            required
            value={form.group}
            maxLength={100}
            onChange={(event) =>
              setForm({ ...form, group: event.target.value })
            }
          />
        </Field>
      </div>
      <EditorActions adding={adding} onCancel={onCancel} />
    </form>
  );
}

function SkillsEditor(props: EditorProps) {
  const [editingId, setEditingId] = useState<string | null>(
    props.editRequest?.entryId ?? null,
  );
  const [adding, setAdding] = useState(false);
  const visible = props.needsReviewOnly
    ? props.data.skills.filter((skill) =>
        props.warnings.some((warning) => warning.target?.entryId === skill.id),
      )
    : props.data.skills;
  const save = (skill: ResumeSkillV1, isAdding: boolean) => {
    const previous = props.data.skills.find((item) => item.id === skill.id);
    if (!isAdding && JSON.stringify(previous) === JSON.stringify(skill)) {
      setEditingId(null);
      if (props.editRequest) props.onConsumeEditRequest();
      return;
    }
    const next = structuredClone(props.data);
    next.skills = isAdding
      ? [...next.skills, skill]
      : next.skills.map((item) => (item.id === skill.id ? skill : item));
    props.onChange(next, {
      section: "skills",
      provenance: isAdding ? "user_entered" : "user_edited",
      changedFields: [
        reference("skills", "skills.name", skill.id),
        reference("skills", "skills.group", skill.id),
      ],
    });
    setEditingId(null);
    setAdding(false);
    if (props.editRequest) props.onConsumeEditRequest();
  };
  const cancelEdit = () => {
    setEditingId(null);
    if (props.editRequest) props.onConsumeEditRequest();
  };
  const groups = visible.reduce((grouped, skill) => {
    grouped.set(skill.group, [...(grouped.get(skill.group) ?? []), skill]);
    return grouped;
  }, new Map<string, ResumeSkillV1[]>());

  return (
    <div className="review-entry-stack">
      {[...groups.entries()].map(([group, skills]) => (
        <section className="review-skill-group" key={group}>
          <h3>{group}</h3>
          <div className="review-skill-list">
            {skills.map((skill) =>
              editingId === skill.id ? (
                <SkillForm
                  key={skill.id}
                  skill={skill}
                  adding={false}
                  onCancel={cancelEdit}
                  onSave={(value) => save(value, false)}
                />
              ) : (
                <div className="review-skill-row" key={skill.id}>
                  <span>{skill.name}</span>
                  {warningCount(props.warnings, skill.id) > 0 ? (
                    <span className="review-warning-marker">Needs review</span>
                  ) : null}
                  <SourceButton
                    target={reference("skills", "skills.name", skill.id)}
                    {...props}
                  />
                  <button
                    className="review-plain-button"
                    type="button"
                    onClick={() => setEditingId(skill.id)}
                  >
                    Edit
                  </button>
                  <button
                    className="review-remove-button"
                    type="button"
                    onClick={() => {
                      if (!window.confirm(`Remove ${skill.name}?`)) return;
                      const next = structuredClone(props.data);
                      next.skills = next.skills.filter(
                        (item) => item.id !== skill.id,
                      );
                      props.onChange(next, {
                        section: "skills",
                        changedFields: [],
                        removedEntryIds: [skill.id],
                      });
                    }}
                  >
                    Remove {skill.name}
                  </button>
                </div>
              ),
            )}
          </div>
        </section>
      ))}
      {adding ? (
        <SkillForm
          skill={{ id: newId("skill"), name: "", group: "Other" }}
          adding
          onCancel={() => setAdding(false)}
          onSave={(skill) => save(skill, true)}
        />
      ) : (
        <button
          className="review-add-button"
          type="button"
          onClick={() => setAdding(true)}
        >
          Add skill
        </button>
      )}
    </div>
  );
}

function EducationForm({
  entry,
  adding,
  onCancel,
  onSave,
}: {
  entry: ResumeEducationV1;
  adding: boolean;
  onCancel: () => void;
  onSave: (entry: ResumeEducationV1) => void;
}) {
  const [form, setForm] = useState(structuredClone(entry));
  const [startDate, setStartDate] = useState(dateInputValue(entry.startDate));
  const [endDate, setEndDate] = useState(dateInputValue(entry.endDate));
  const { error, setError, errorRef } = useFormError();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const nextStartDate = parsePartialDate(startDate);
      const nextEndDate = parsePartialDate(endDate);
      if (isDateAfter(nextStartDate, nextEndDate)) {
        setError("The end date cannot be before the start date.");
        return;
      }
      const parsed = ResumeEducationV1Schema.safeParse({
        ...form,
        startDate: nextStartDate,
        endDate: nextEndDate,
      });
      if (!parsed.success) {
        setError("Review this education entry and its dates.");
        return;
      }
      onSave(parsed.data);
    } catch (dateError) {
      setError(
        dateError instanceof Error ? dateError.message : "Review the dates.",
      );
    }
  };
  return (
    <form className="review-edit-form" onSubmit={submit}>
      {error ? (
        <div
          ref={errorRef}
          className="review-form-error"
          role="alert"
          tabIndex={-1}
        >
          {error}
        </div>
      ) : null}
      <div className="review-field-grid">
        <Field label="Institution">
          <input
            autoFocus
            required
            value={form.institution ?? ""}
            maxLength={240}
            onChange={(event) =>
              setForm({ ...form, institution: event.target.value || null })
            }
          />
        </Field>
        <Field label="Degree">
          <input
            value={form.degree ?? ""}
            maxLength={200}
            onChange={(event) =>
              setForm({ ...form, degree: event.target.value || null })
            }
          />
        </Field>
        <Field label="Field of study">
          <input
            value={form.field ?? ""}
            maxLength={200}
            onChange={(event) =>
              setForm({ ...form, field: event.target.value || null })
            }
          />
        </Field>
        <Field label="Broad location">
          <input
            value={form.location ?? ""}
            maxLength={200}
            onChange={(event) =>
              setForm({ ...form, location: event.target.value || null })
            }
          />
        </Field>
        <Field label="Start date" hint="Use YYYY or YYYY-MM.">
          <input
            inputMode="numeric"
            pattern="\d{4}(-\d{2})?"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </Field>
        <Field label="End or expected date" hint="Use YYYY or YYYY-MM.">
          <input
            inputMode="numeric"
            pattern="\d{4}(-\d{2})?"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </Field>
        <Field label="Private GPA">
          <input
            value={form.gpa ?? ""}
            maxLength={40}
            onChange={(event) =>
              setForm({ ...form, gpa: event.target.value || null })
            }
          />
        </Field>
      </div>
      <label className="review-checkbox">
        <input
          type="checkbox"
          checked={form.expected}
          onChange={(event) =>
            setForm({ ...form, expected: event.target.checked })
          }
        />
        This is an expected graduation date
      </label>
      <fieldset className="review-list-editor">
        <legend>Honors</legend>
        {form.honors.map((honor, index) => (
          <div
            className="review-list-edit-row review-list-edit-row-wide"
            key={honor.id}
          >
            <Field label={`Honor ${index + 1}`}>
              <input
                required
                value={honor.text}
                maxLength={300}
                onChange={(event) =>
                  setForm({
                    ...form,
                    honors: form.honors.map((item) =>
                      item.id === honor.id
                        ? { ...item, text: event.target.value }
                        : item,
                    ),
                  })
                }
              />
            </Field>
            <button
              className="review-remove-button"
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  honors: form.honors.filter((item) => item.id !== honor.id),
                })
              }
            >
              Remove honor {index + 1}
            </button>
          </div>
        ))}
        <button
          className="review-add-button"
          type="button"
          onClick={() =>
            setForm({
              ...form,
              honors: [...form.honors, { id: newId("honor"), text: "" }],
            })
          }
        >
          Add honor
        </button>
      </fieldset>
      <EditorActions adding={adding} onCancel={onCancel} />
    </form>
  );
}

function EducationEditor(props: EditorProps) {
  const [editingId, setEditingId] = useState<string | null>(
    props.editRequest?.entryId ?? null,
  );
  const [adding, setAdding] = useState(false);
  const visible = props.needsReviewOnly
    ? props.data.education.filter((entry) =>
        props.warnings.some((warning) => warning.target?.entryId === entry.id),
      )
    : props.data.education;
  const save = (entry: ResumeEducationV1, isAdding: boolean) => {
    const previous = props.data.education.find((item) => item.id === entry.id);
    if (!isAdding && JSON.stringify(previous) === JSON.stringify(entry)) {
      setEditingId(null);
      if (props.editRequest) props.onConsumeEditRequest();
      return;
    }
    const next = structuredClone(props.data);
    next.education = isAdding
      ? [...next.education, entry]
      : next.education.map((item) => (item.id === entry.id ? entry : item));
    const changedFields = [
      "institution",
      "degree",
      "field",
      "location",
      "startDate",
      "endDate",
      "expected",
      "gpa",
    ]
      .map((field) =>
        reference("education", `education.${field}` as DraftFieldKey, entry.id),
      )
      .concat(
        entry.honors.map((honor) =>
          reference("education", "education.honors.text", entry.id, honor.id),
        ),
      );
    const previousHonorIds = new Set(
      previous?.honors.map((item) => item.id) ?? [],
    );
    props.onChange(next, {
      section: "education",
      provenance: isAdding ? "user_entered" : "user_edited",
      changedFields,
      enteredFields: changedFields.filter(
        (target) =>
          isAdding ||
          (target.itemId !== null && !previousHonorIds.has(target.itemId)),
      ),
      removedEntryIds: previous?.honors
        .filter((item) => !entry.honors.some((honor) => honor.id === item.id))
        .map((item) => item.id),
    });
    setEditingId(null);
    setAdding(false);
    if (props.editRequest) props.onConsumeEditRequest();
  };
  const cancelEdit = () => {
    setEditingId(null);
    if (props.editRequest) props.onConsumeEditRequest();
  };
  return (
    <div className="review-entry-stack">
      {visible.map((entry) =>
        editingId === entry.id ? (
          <EducationForm
            key={entry.id}
            entry={entry}
            adding={false}
            onCancel={cancelEdit}
            onSave={(value) => save(value, false)}
          />
        ) : (
          <article className="review-entry-card" key={entry.id}>
            <CardHeader
              title={entry.institution ?? "Institution not provided"}
              subtitle={
                [entry.degree, entry.field].filter(Boolean).join(", ") ||
                undefined
              }
              warnings={warningCount(props.warnings, entry.id)}
            />
            <p className="review-card-meta">
              {dateRange(entry.startDate, entry.endDate)}
              {entry.expected ? " · Expected" : ""}
              {entry.location ? ` · ${entry.location}` : ""}
            </p>
            {entry.gpa ? (
              <p className="review-private-value">Private GPA: {entry.gpa}</p>
            ) : null}
            {entry.honors.length > 0 ? (
              <ul className="review-bullet-list">
                {entry.honors.map((honor) => (
                  <li key={honor.id}>{honor.text}</li>
                ))}
              </ul>
            ) : null}
            <div className="review-card-actions">
              <button
                className="resume-secondary-button"
                type="button"
                onClick={() => setEditingId(entry.id)}
              >
                Edit
              </button>
              <SourceButton
                target={reference(
                  "education",
                  "education.institution",
                  entry.id,
                )}
                {...props}
              />
              <button
                className="review-remove-button"
                type="button"
                onClick={() => {
                  if (!window.confirm("Remove this education entry?")) return;
                  const next = structuredClone(props.data);
                  next.education = next.education.filter(
                    (item) => item.id !== entry.id,
                  );
                  props.onChange(next, {
                    section: "education",
                    changedFields: [],
                    removedEntryIds: [entry.id],
                  });
                }}
              >
                Remove
              </button>
            </div>
          </article>
        ),
      )}
      {adding ? (
        <EducationForm
          entry={{
            id: newId("education"),
            institution: null,
            degree: null,
            field: null,
            location: null,
            startDate: null,
            endDate: null,
            expected: false,
            gpa: null,
            gpaPublic: false,
            honors: [],
          }}
          adding
          onCancel={() => setAdding(false)}
          onSave={(entry) => save(entry, true)}
        />
      ) : (
        <button
          className="review-add-button"
          type="button"
          onClick={() => setAdding(true)}
        >
          Add education
        </button>
      )}
    </div>
  );
}

export function ResumeSectionEditor(props: EditorProps) {
  const editorKey = props.editRequest
    ? `forced-${props.editRequest.entryId ?? "section"}`
    : `section-${props.section}`;
  switch (props.section) {
    case "profile":
      return <ProfileEditor key={editorKey} {...props} />;
    case "experience":
      return <ExperienceEditor key={editorKey} {...props} />;
    case "projects":
      return <ProjectEditor key={editorKey} {...props} />;
    case "skills":
      return <SkillsEditor key={editorKey} {...props} />;
    case "education":
      return <EducationEditor key={editorKey} {...props} />;
  }
}
