/**
 * Debug Component for Kanban Board Issue
 *
 * PURPOSE: Identify why 6 columns appear instead of 4 when dealer filter is selected
 *
 * Add this component to page.tsx temporarily to diagnose the issue
 */

export function KanbanDebug({
  selectedType,
  dealerSteps,
  tasksByStatus,
  filteredTasks
}: any) {

  if (selectedType !== 'dealer') return null;

  const dealerTasks = filteredTasks.filter((t: any) => t.type === 'dealer');
  const uniqueStatuses = new Set(dealerTasks.map((t: any) => t.status));

  console.log('🐛 [KANBAN DEBUG] ==================');
  console.log('🎯 Selected Type:', selectedType);
  console.log('📋 Dealer Steps (should be 4):', dealerSteps);
  console.log('📊 TasksByStatus Steps:', tasksByStatus.steps);
  console.log('🏷️ Unique Statuses in Dealer Tasks:', Array.from(uniqueStatuses));
  console.log('📦 Dealer Tasks:', dealerTasks.map((t: any) => ({
    id: t.id,
    business: t.businessName,
    type: t.type,
    status: t.status,
    title: t.title
  })));
  console.log('🔢 Expected Columns: 4');
  console.log('🔢 Actual Columns:', tasksByStatus.steps.length);
  console.log('==================');

  return (
    <div className="bg-yellow-50 border-2 border-yellow-300 rounded p-4 mb-4">
      <h3 className="font-bold text-yellow-800 mb-2">🐛 KANBAN DEBUG INFO</h3>
      <div className="text-sm space-y-1">
        <p><strong>Selected Type:</strong> {selectedType}</p>
        <p><strong>Dealer Steps Count:</strong> {dealerSteps.length}</p>
        <p><strong>TasksByStatus Steps Count:</strong> {tasksByStatus.steps.length}</p>
        <p><strong>Dealer Tasks Count:</strong> {dealerTasks.length}</p>
        <p><strong>Unique Statuses in Dealer Tasks:</strong></p>
        <ul className="ml-4 list-disc">
          {Array.from(uniqueStatuses).map((status: any) => (
            <li key={status}>
              {status} ({dealerTasks.filter((t: any) => t.status === status).length} tasks)
            </li>
          ))}
        </ul>
        <p className="mt-2"><strong>TasksByStatus Steps:</strong></p>
        <ul className="ml-4 list-disc">
          {tasksByStatus.steps.map((step: any) => (
            <li key={step.status} className={
              !dealerSteps.find((ds: any) => ds.status === step.status)
                ? 'text-red-600 font-bold'
                : 'text-green-600'
            }>
              {step.label} ({step.status}) - {tasksByStatus.grouped[step.status]?.length || 0} tasks
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
