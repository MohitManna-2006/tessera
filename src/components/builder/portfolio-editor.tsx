"use client";

import { Fragment, type ChangeEvent, type ReactNode } from "react";

import {
  isValidEmail,
  isValidHttpUrl,
  PORTFOLIO_SECTION_ORDER,
  type Education,
  type Experience,
  type Portfolio,
  type PortfolioSectionId,
  type Project,
  type SkillGroup,
} from "@/lib/portfolio";

import { EditorSection } from "./editor-section";

type PortfolioEditorProps = {
  portfolio: Portfolio;
  openSections: ReadonlySet<PortfolioSectionId>;
  onToggleSection: (section: PortfolioSectionId) => void;
  onChange: (portfolio: Portfolio) => void;
};

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  optional?: boolean;
  multiline?: boolean;
  rows?: number;
  inputMode?: "email" | "url" | "text";
};

function Field({
  id,
  label,
  value,
  onChange,
  error,
  optional = false,
  multiline = false,
  rows = 3,
  inputMode = "text",
}: FieldProps) {
  const errorId = `${id}-error`;
  const sharedProps = {
    id,
    className: `form-control${error ? " form-control-error" : ""}`,
    value,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? errorId : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
  };

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {optional ? <span className="optional-label">Optional</span> : null}
      </label>
      {multiline ? (
        <textarea {...sharedProps} rows={rows} />
      ) : (
        <input {...sharedProps} type="text" inputMode={inputMode} />
      )}
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="field-grid">{children}</div>;
}

export function PortfolioEditor({
  portfolio,
  openSections,
  onToggleSection,
  onChange,
}: PortfolioEditorProps) {
  const updateProfile = (field: keyof Portfolio["profile"], value: string) => {
    onChange({
      ...portfolio,
      profile: { ...portfolio.profile, [field]: value },
    });
  };

  const updateLinks = (field: keyof Portfolio["links"], value: string) => {
    onChange({
      ...portfolio,
      links: { ...portfolio.links, [field]: value },
    });
  };

  const updateExperience = (
    index: number,
    field: keyof Omit<Experience, "highlights">,
    value: string,
  ) => {
    onChange({
      ...portfolio,
      experience: portfolio.experience.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry,
      ) as Portfolio["experience"],
    });
  };

  const updateExperienceHighlight = (
    entryIndex: number,
    highlightIndex: number,
    value: string,
  ) => {
    onChange({
      ...portfolio,
      experience: portfolio.experience.map((entry, index) =>
        index === entryIndex
          ? {
              ...entry,
              highlights: entry.highlights.map((highlight, currentIndex) =>
                currentIndex === highlightIndex ? value : highlight,
              ) as Experience["highlights"],
            }
          : entry,
      ) as Portfolio["experience"],
    });
  };

  const updateProject = (
    index: number,
    field: keyof Omit<Project, "highlights" | "featured">,
    value: string,
  ) => {
    onChange({
      ...portfolio,
      projects: portfolio.projects.map((project, projectIndex) =>
        projectIndex === index ? { ...project, [field]: value } : project,
      ) as Portfolio["projects"],
    });
  };

  const updateProjectHighlight = (
    projectIndex: number,
    highlightIndex: number,
    value: string,
  ) => {
    onChange({
      ...portfolio,
      projects: portfolio.projects.map((project, index) =>
        index === projectIndex
          ? {
              ...project,
              highlights: project.highlights.map((highlight, currentIndex) =>
                currentIndex === highlightIndex ? value : highlight,
              ) as Project["highlights"],
            }
          : project,
      ) as Portfolio["projects"],
    });
  };

  const updateSkillGroup = (
    index: number,
    field: keyof SkillGroup,
    value: string,
  ) => {
    onChange({
      ...portfolio,
      skillGroups: portfolio.skillGroups.map((group, groupIndex) =>
        groupIndex === index ? { ...group, [field]: value } : group,
      ) as Portfolio["skillGroups"],
    });
  };

  const updateEducation = (field: keyof Education, value: string) => {
    onChange({
      ...portfolio,
      education: { ...portfolio.education, [field]: value },
    });
  };

  const emailError =
    portfolio.links.email && !isValidEmail(portfolio.links.email)
      ? "Enter a complete email address."
      : undefined;
  const githubError =
    portfolio.links.githubUrl && !isValidHttpUrl(portfolio.links.githubUrl)
      ? "Enter a full URL beginning with http:// or https://."
      : undefined;
  const linkedinError =
    portfolio.links.linkedinUrl && !isValidHttpUrl(portfolio.links.linkedinUrl)
      ? "Enter a full URL beginning with http:// or https://."
      : undefined;

  const editorSections: Record<PortfolioSectionId, ReactNode> = {
    profile: (
      <EditorSection
        id="profile"
        title="Profile"
        isOpen={openSections.has("profile")}
        onToggle={() => onToggleSection("profile")}
      >
        <Field
          id="full-name"
          label="Full name"
          value={portfolio.profile.fullName}
          onChange={(value) => updateProfile("fullName", value)}
        />
        <Field
          id="headline"
          label="Professional headline"
          value={portfolio.profile.headline}
          onChange={(value) => updateProfile("headline", value)}
        />
        <Field
          id="biography"
          label="Short biography"
          value={portfolio.profile.biography}
          onChange={(value) => updateProfile("biography", value)}
          multiline
          rows={4}
        />
        <Field
          id="location"
          label="Location"
          value={portfolio.profile.location}
          onChange={(value) => updateProfile("location", value)}
        />
      </EditorSection>
    ),
    links: (
      <EditorSection
        id="links"
        title="Links"
        isOpen={openSections.has("links")}
        onToggle={() => onToggleSection("links")}
      >
        <Field
          id="email"
          label="Email"
          value={portfolio.links.email}
          onChange={(value) => updateLinks("email", value)}
          inputMode="email"
          error={emailError}
        />
        <Field
          id="github-url"
          label="GitHub URL"
          value={portfolio.links.githubUrl}
          onChange={(value) => updateLinks("githubUrl", value)}
          inputMode="url"
          error={githubError}
        />
        <Field
          id="linkedin-url"
          label="LinkedIn URL"
          value={portfolio.links.linkedinUrl}
          onChange={(value) => updateLinks("linkedinUrl", value)}
          inputMode="url"
          error={linkedinError}
        />
      </EditorSection>
    ),
    experience: (
      <EditorSection
        id="experience"
        title="Experience"
        isOpen={openSections.has("experience")}
        onToggle={() => onToggleSection("experience")}
      >
        {portfolio.experience.map((entry, index) => (
          <div className="entry-editor" key={`experience-${index}`}>
            <h3>
              <span className="entry-number">0{index + 1}</span>
              {entry.organization || `Experience ${index + 1}`}
            </h3>
            <FieldGrid>
              <Field
                id={`experience-${index}-organization`}
                label="Organization"
                value={entry.organization}
                onChange={(value) =>
                  updateExperience(index, "organization", value)
                }
              />
              <Field
                id={`experience-${index}-role`}
                label="Role"
                value={entry.role}
                onChange={(value) => updateExperience(index, "role", value)}
              />
              <Field
                id={`experience-${index}-location`}
                label="Location"
                value={entry.location}
                onChange={(value) => updateExperience(index, "location", value)}
              />
              <FieldGrid>
                <Field
                  id={`experience-${index}-start`}
                  label="Start"
                  value={entry.startDate}
                  onChange={(value) =>
                    updateExperience(index, "startDate", value)
                  }
                />
                <Field
                  id={`experience-${index}-end`}
                  label="End"
                  value={entry.endDate}
                  onChange={(value) =>
                    updateExperience(index, "endDate", value)
                  }
                />
              </FieldGrid>
            </FieldGrid>
            {entry.highlights.map((highlight, highlightIndex) => (
              <Field
                id={`experience-${index}-highlight-${highlightIndex}`}
                label={`Highlight ${highlightIndex + 1}`}
                value={highlight}
                onChange={(value) =>
                  updateExperienceHighlight(index, highlightIndex, value)
                }
                multiline
                key={`experience-${index}-highlight-${highlightIndex}`}
              />
            ))}
          </div>
        ))}
      </EditorSection>
    ),
    projects: (
      <EditorSection
        id="projects"
        title="Projects"
        isOpen={openSections.has("projects")}
        onToggle={() => onToggleSection("projects")}
      >
        {portfolio.projects.map((project, index) => {
          const repositoryError =
            project.repositoryUrl && !isValidHttpUrl(project.repositoryUrl)
              ? "Enter a full URL beginning with http:// or https://."
              : undefined;
          const liveUrlError =
            project.liveUrl && !isValidHttpUrl(project.liveUrl)
              ? "Enter a full URL beginning with http:// or https://."
              : undefined;

          return (
            <div className="entry-editor" key={`project-${index}`}>
              <h3>
                <span className="entry-number">0{index + 1}</span>
                {project.name || `Project ${index + 1}`}
              </h3>
              <Field
                id={`project-${index}-name`}
                label="Project name"
                value={project.name}
                onChange={(value) => updateProject(index, "name", value)}
              />
              <Field
                id={`project-${index}-summary`}
                label="Summary"
                value={project.summary}
                onChange={(value) => updateProject(index, "summary", value)}
                multiline
              />
              {project.highlights.map((highlight, highlightIndex) => (
                <Field
                  id={`project-${index}-highlight-${highlightIndex}`}
                  label={`Highlight ${highlightIndex + 1}`}
                  value={highlight}
                  onChange={(value) =>
                    updateProjectHighlight(index, highlightIndex, value)
                  }
                  multiline
                  key={`project-${index}-highlight-${highlightIndex}`}
                />
              ))}
              <Field
                id={`project-${index}-technologies`}
                label="Technologies"
                value={project.technologies}
                onChange={(value) =>
                  updateProject(index, "technologies", value)
                }
              />
              <Field
                id={`project-${index}-repository`}
                label="Repository URL"
                value={project.repositoryUrl}
                onChange={(value) =>
                  updateProject(index, "repositoryUrl", value)
                }
                inputMode="url"
                error={repositoryError}
              />
              <Field
                id={`project-${index}-live`}
                label="Live URL"
                value={project.liveUrl}
                onChange={(value) => updateProject(index, "liveUrl", value)}
                inputMode="url"
                error={liveUrlError}
                optional
              />
            </div>
          );
        })}
      </EditorSection>
    ),
    skills: (
      <EditorSection
        id="skills"
        title="Skills"
        isOpen={openSections.has("skills")}
        onToggle={() => onToggleSection("skills")}
      >
        {portfolio.skillGroups.map((group, index) => (
          <div className="entry-editor skill-editor" key={`skill-${index}`}>
            <h3>
              <span className="entry-number">0{index + 1}</span>
              {group.name || `Group ${index + 1}`}
            </h3>
            <Field
              id={`skill-${index}-name`}
              label="Group name"
              value={group.name}
              onChange={(value) => updateSkillGroup(index, "name", value)}
            />
            <Field
              id={`skill-${index}-items`}
              label="Skills"
              value={group.skills}
              onChange={(value) => updateSkillGroup(index, "skills", value)}
              multiline
              rows={2}
            />
          </div>
        ))}
      </EditorSection>
    ),
    education: (
      <EditorSection
        id="education"
        title="Education"
        isOpen={openSections.has("education")}
        onToggle={() => onToggleSection("education")}
      >
        <Field
          id="education-institution"
          label="Institution"
          value={portfolio.education.institution}
          onChange={(value) => updateEducation("institution", value)}
        />
        <FieldGrid>
          <Field
            id="education-degree"
            label="Degree"
            value={portfolio.education.degree}
            onChange={(value) => updateEducation("degree", value)}
          />
          <Field
            id="education-field"
            label="Field"
            value={portfolio.education.field}
            onChange={(value) => updateEducation("field", value)}
          />
          <FieldGrid>
            <Field
              id="education-start"
              label="Start"
              value={portfolio.education.startDate}
              onChange={(value) => updateEducation("startDate", value)}
            />
            <Field
              id="education-end"
              label="End"
              value={portfolio.education.endDate}
              onChange={(value) => updateEducation("endDate", value)}
            />
          </FieldGrid>
        </FieldGrid>
      </EditorSection>
    ),
  };

  return (
    <form
      className="portfolio-form"
      onSubmit={(event) => event.preventDefault()}
    >
      {PORTFOLIO_SECTION_ORDER.map((section) => (
        <Fragment key={section}>{editorSections[section]}</Fragment>
      ))}
    </form>
  );
}
