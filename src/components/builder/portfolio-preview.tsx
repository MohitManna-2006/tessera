import { Fragment, type ReactNode } from "react";

import {
  formatUrl,
  isValidEmail,
  isValidHttpUrl,
  PORTFOLIO_SECTION_ORDER,
  type Portfolio,
  type PortfolioSectionId,
  type Project,
} from "@/lib/portfolio";

type PortfolioPreviewProps = {
  portfolio: Portfolio;
  isPrimaryHeading?: boolean;
};

function ProjectLinks({ project }: { project: Project }) {
  return (
    <div className="project-links">
      {project.repositoryUrl ? (
        isValidHttpUrl(project.repositoryUrl) ? (
          <a href={project.repositoryUrl} target="_blank" rel="noreferrer">
            Repository <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <span className="invalid-preview-value">{project.repositoryUrl}</span>
        )
      ) : null}
      {project.liveUrl ? (
        isValidHttpUrl(project.liveUrl) ? (
          <a href={project.liveUrl} target="_blank" rel="noreferrer">
            Live site <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <span className="invalid-preview-value">{project.liveUrl}</span>
        )
      ) : null}
    </div>
  );
}

export function PortfolioPreview({
  portfolio,
  isPrimaryHeading = false,
}: PortfolioPreviewProps) {
  const NameHeading = isPrimaryHeading ? "h1" : "h2";
  const sortedProjects = portfolio.projects
    .map((project, index) => ({ project, index }))
    .sort(
      (left, right) =>
        Number(right.project.featured) - Number(left.project.featured) ||
        left.index - right.index,
    )
    .map(({ project }) => project);

  const previewSections: Record<PortfolioSectionId, ReactNode> = {
    profile: (
      <div data-portfolio-section="profile">
        <p className="preview-kicker">Software engineer</p>
        <NameHeading>{portfolio.profile.fullName || "Your name"}</NameHeading>
        <p className="preview-headline">
          {portfolio.profile.headline || "Your professional headline"}
        </p>
        {portfolio.profile.location ? (
          <p className="preview-location">{portfolio.profile.location}</p>
        ) : null}
        {portfolio.profile.biography ? (
          <p className="preview-biography">{portfolio.profile.biography}</p>
        ) : null}
      </div>
    ),
    links: (
      <nav
        className="preview-contact"
        aria-label="Contact links"
        data-portfolio-section="links"
      >
        {portfolio.links.email ? (
          isValidEmail(portfolio.links.email) ? (
            <a href={`mailto:${portfolio.links.email}`}>
              {portfolio.links.email}
            </a>
          ) : (
            <span className="invalid-preview-value">
              {portfolio.links.email}
            </span>
          )
        ) : null}
        {portfolio.links.githubUrl ? (
          isValidHttpUrl(portfolio.links.githubUrl) ? (
            <a
              href={portfolio.links.githubUrl}
              target="_blank"
              rel="noreferrer"
            >
              {formatUrl(portfolio.links.githubUrl)}
            </a>
          ) : (
            <span className="invalid-preview-value">
              {portfolio.links.githubUrl}
            </span>
          )
        ) : null}
        {portfolio.links.linkedinUrl ? (
          isValidHttpUrl(portfolio.links.linkedinUrl) ? (
            <a
              href={portfolio.links.linkedinUrl}
              target="_blank"
              rel="noreferrer"
            >
              {formatUrl(portfolio.links.linkedinUrl)}
            </a>
          ) : (
            <span className="invalid-preview-value">
              {portfolio.links.linkedinUrl}
            </span>
          )
        ) : null}
      </nav>
    ),
    experience: (
      <section
        className="preview-section"
        aria-labelledby="experience-heading"
        data-portfolio-section="experience"
      >
        <h3 id="experience-heading">Experience</h3>
        <div className="experience-list">
          {portfolio.experience.map((entry, index) => (
            <article
              className="preview-experience"
              key={`preview-experience-${index}`}
            >
              <div className="experience-heading">
                <div>
                  <h4>{entry.organization || `Experience ${index + 1}`}</h4>
                  <p>{entry.role}</p>
                </div>
                <p className="experience-meta">
                  <span>
                    {entry.startDate}
                    {entry.startDate || entry.endDate ? " — " : ""}
                    {entry.endDate}
                  </span>
                  {entry.location ? <span>{entry.location}</span> : null}
                </p>
              </div>
              <ul>
                {entry.highlights
                  .filter(Boolean)
                  .map((highlight, highlightIndex) => (
                    <li key={`experience-highlight-${highlightIndex}`}>
                      {highlight}
                    </li>
                  ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    ),
    projects: (
      <section
        className="preview-section"
        aria-labelledby="selected-work"
        data-portfolio-section="projects"
      >
        <h3 id="selected-work">Selected work</h3>
        <div className="project-list">
          {sortedProjects.map((project, index) => (
            <article
              className="preview-project"
              key={`preview-project-${index}`}
            >
              <div className="project-heading">
                <h4>{project.name || `Project ${index + 1}`}</h4>
                <ProjectLinks project={project} />
              </div>
              {project.summary ? (
                <p className="project-summary">{project.summary}</p>
              ) : null}
              <ul>
                {project.highlights
                  .filter(Boolean)
                  .map((highlight, highlightIndex) => (
                    <li key={`project-highlight-${highlightIndex}`}>
                      {highlight}
                    </li>
                  ))}
              </ul>
              {project.technologies ? (
                <p className="technology-line">
                  <span>Built with</span> {project.technologies}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    ),
    skills: (
      <section
        className="preview-section"
        aria-labelledby="skills-heading"
        data-portfolio-section="skills"
      >
        <h3 id="skills-heading">Skills</h3>
        <div className="skill-list">
          {portfolio.skillGroups.map((group, index) => (
            <div key={`preview-skill-${index}`}>
              <h4>{group.name || `Group ${index + 1}`}</h4>
              <p>{group.skills}</p>
            </div>
          ))}
        </div>
      </section>
    ),
    education: (
      <section
        className="preview-section"
        aria-labelledby="education-heading"
        data-portfolio-section="education"
      >
        <h3 id="education-heading">Education</h3>
        <div className="education-row">
          <div>
            <h4>{portfolio.education.institution}</h4>
            <p>
              {[portfolio.education.degree, portfolio.education.field]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
          <p className="education-dates">
            {portfolio.education.startDate}
            {portfolio.education.startDate || portfolio.education.endDate
              ? " — "
              : ""}
            {portfolio.education.endDate}
          </p>
        </div>
      </section>
    ),
  };

  return (
    <article className="portfolio-canvas" aria-label="Portfolio preview">
      <header className="preview-intro">
        {PORTFOLIO_SECTION_ORDER.slice(0, 2).map((section) => (
          <Fragment key={section}>{previewSections[section]}</Fragment>
        ))}
      </header>
      {PORTFOLIO_SECTION_ORDER.slice(2).map((section) => (
        <Fragment key={section}>{previewSections[section]}</Fragment>
      ))}
      {portfolio.links.email ? (
        <footer className="preview-footer">
          <p>
            Interested in working together?{" "}
            {isValidEmail(portfolio.links.email) ? (
              <a href={`mailto:${portfolio.links.email}`}>Send an email.</a>
            ) : (
              <span>Get in touch.</span>
            )}
          </p>
        </footer>
      ) : null}
    </article>
  );
}
