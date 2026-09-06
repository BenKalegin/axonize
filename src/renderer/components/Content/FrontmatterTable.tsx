import { parseFrontmatter } from '@core/markdown/frontmatter'

interface FrontmatterTableProps {
  /** The raw frontmatter block, including the `---` fences, as stored from the file. */
  raw: string
}

const URL_PATTERN = /^https?:\/\/\S+$/

/** Renders a markdown file's YAML frontmatter as a GitHub-style key/value table. */
export function FrontmatterTable({ raw }: FrontmatterTableProps) {
  const entries = parseFrontmatter(raw)
  if (entries.length === 0) return null

  return (
    <table className="frontmatter-table">
      <tbody>
        {entries.map(({ key, value }) => (
          <tr key={key}>
            <td className="frontmatter-table-key">{key}</td>
            <td className="frontmatter-table-value">
              <FrontmatterValue value={value} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function FrontmatterValue({ value }: { value: string | string[] }) {
  if (Array.isArray(value)) {
    return (
      <span className="frontmatter-table-chips">
        {value.map((item) => (
          <span key={item} className="frontmatter-table-chip">
            {item}
          </span>
        ))}
      </span>
    )
  }
  if (URL_PATTERN.test(value)) {
    return <a href={value}>{value}</a>
  }
  return <>{value}</>
}
