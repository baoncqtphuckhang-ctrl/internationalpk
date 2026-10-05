const fs = require('fs');
const file = 'components/MaterialProcessing.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `{getNextActions(activeTab).map(action => (
                                        <button
                                            key={action.value}
                                            onClick={() => updateStatus(order.id, action.value)}`;

const replacement = `{getNextActions(activeTab).map(action => (
                                        <button
                                            key={action.label}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (action.isEdit && onNavigateToEdit) {
                                                    onNavigateToEdit(order);
                                                } else {
                                                    updateStatus(order.id, action.value);
                                                }
                                            }}`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated Kanban card actions in MaterialProcessing.jsx");
} else {
    console.log("Target not found!");
}
