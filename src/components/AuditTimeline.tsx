import type { Criterion, ScoreAuditEvent, User, Vendor } from '../types/domain';

interface AuditTimelineProps {
  events: ScoreAuditEvent[];
  vendors: Vendor[];
  criteria: Criterion[];
  users: User[];
}

export function AuditTimeline({ events, vendors, criteria, users }: AuditTimelineProps) {
  const ordered = [...events].sort((a, b) => b.changedAt.localeCompare(a.changedAt));

  return (
    <section className="panel">
      <header className="panel-header">
        <h3>Audit Timeline</h3>
      </header>

      <div className="table-wrap">
        <table className="plain-table">
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Role</th>
              <th>Vendor</th>
              <th>Criterion</th>
              <th>Old Value</th>
              <th>New Value</th>
              <th>Old Comment</th>
              <th>New Comment</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.changedAt).toLocaleString()}</td>
                <td>{users.find((user) => user.id === event.changedById)?.name ?? event.changedById}</td>
                <td>{event.changedByRole}</td>
                <td>{vendors.find((vendor) => vendor.id === event.vendorId)?.name ?? event.vendorId}</td>
                <td>{criteria.find((criterion) => criterion.id === event.criterionId)?.label ?? event.criterionId}</td>
                <td>{event.oldValue ?? '-'}</td>
                <td>{event.newValue ?? '-'}</td>
                <td>{event.oldComment || '-'}</td>
                <td>{event.newComment || '-'}</td>
              </tr>
            ))}
            {ordered.length === 0 && (
              <tr>
                <td colSpan={9}>No score changes recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
