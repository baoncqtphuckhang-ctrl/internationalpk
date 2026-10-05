const fs = require('fs');
const path = require('path');

// --- 1. PATCH MaterialOrder.jsx ---
const fileOrder = 'components/MaterialOrder.jsx';
let contentOrder = fs.readFileSync(fileOrder, 'utf8');

// Add onCloseModal to props
if (contentOrder.includes('export default function MaterialOrder({ currentUser, usersList = [], projects = [], actionOrder })')) {
    contentOrder = contentOrder.replace(
        'export default function MaterialOrder({ currentUser, usersList = [], projects = [], actionOrder })',
        'export default function MaterialOrder({ currentUser, usersList = [], projects = [], actionOrder, asModal, onCloseModal })'
    );
}

// Helper to replace setView
const oldSetView = "setView('list')";
const newSetView = "if (onCloseModal) onCloseModal(); else setView('list')";
// There are multiple instances of setView('list')!
// Instead of simple replace, let's use global regex for the exact ones
contentOrder = contentOrder.replace(/setView\('list'\)/g, "if (onCloseModal) onCloseModal(); else setView('list')");

// Also, if it is asModal, we shouldn't render the header and the list view at all.
// At the return statement, if asModal, only render the form or detail.
const renderStart = `return (
        <div className="w-full animate-in fade-in duration-500 pb-16">`;

const newRenderStart = `return (
        <div className={\`w-full animate-in fade-in duration-500 pb-16 \${asModal ? 'bg-transparent pb-0' : ''}\`}>`;

if (contentOrder.includes(renderStart)) {
    contentOrder = contentOrder.replace(renderStart, newRenderStart);
}

// Wrap the HEADER AREA and TABLE VIEW in !asModal
contentOrder = contentOrder.replace(`{/* HEADER AREA */}`, `{/* HEADER AREA */}\n            {!asModal && (`);
contentOrder = contentOrder.replace(`{/* TABLE VIEW */}`, `)}\n\n            {/* TABLE VIEW */}\n            {!asModal && (`);
contentOrder = contentOrder.replace(`{/* ORDER FORM */}`, `)}\n\n            {/* ORDER FORM */}`);

fs.writeFileSync(fileOrder, contentOrder, 'utf8');
console.log("Patched MaterialOrder.jsx");

// --- 2. PATCH MaterialProcessing.jsx ---
const fileProc = 'components/MaterialProcessing.jsx';
let contentProc = fs.readFileSync(fileProc, 'utf8');

// Add editOrder state
if (!contentProc.includes('const [editOrder, setEditOrder] = useState(null);')) {
    contentProc = contentProc.replace(
        'const [previewOrder, setPreviewOrder] = useState(null);',
        'const [previewOrder, setPreviewOrder] = useState(null);\n    const [editOrder, setEditOrder] = useState(null);'
    );
}

// Import MaterialOrder in MaterialProcessing.jsx if not already
if (!contentProc.includes('import MaterialOrder from')) {
    contentProc = contentProc.replace(
        "import { CheckCircle, XCircle, Clock, Search, ShoppingCart, Loader2, ArrowRight } from 'lucide-react';",
        "import { CheckCircle, XCircle, Clock, Search, ShoppingCart, Loader2, ArrowRight } from 'lucide-react';\nimport MaterialOrder from '@/components/MaterialOrder';"
    );
}

// Replace onNavigateToEdit calls with setEditOrder
contentProc = contentProc.replace(/if \(action\.isEdit && onNavigateToEdit\) \{\s*onNavigateToEdit\(order\);\s*\}/g, "if (action.isEdit) { setEditOrder(order); }");
contentProc = contentProc.replace(/if \(action\.isEdit && onNavigateToEdit\) \{\s*onNavigateToEdit\(previewOrder\);\s*setPreviewOrder\(null\);\s*\}/g, "if (action.isEdit) { setEditOrder(previewOrder); setPreviewOrder(null); }");

// Add Edit Modal JSX
const editModalJSX = `
            {/* EDIT MODAL */}
            {editOrder && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto bg-black/60 backdrop-blur-sm p-4 sm:p-8" onClick={() => setEditOrder(null)}>
                    <div className="w-full max-w-[1200px] bg-white rounded-3xl overflow-hidden relative shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-4 sm:p-8">
                            <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
                                Sửa Phiếu: {editOrder.project_name}
                                <button onClick={() => setEditOrder(null)} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition"><XCircle size={20} /></button>
                            </h2>
                            <MaterialOrder 
                                currentUser={currentUser}
                                projects={projects}
                                actionOrder={{ order: editOrder, action: 'edit' }}
                                asModal={true}
                                onCloseModal={() => setEditOrder(null)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
`;

if (!contentProc.includes('EDIT MODAL')) {
    contentProc = contentProc.replace(/<\/div>\s*\);\s*}\s*$/g, editModalJSX);
    fs.writeFileSync(fileProc, contentProc, 'utf8');
    console.log("Patched MaterialProcessing.jsx");
} else {
    console.log("EDIT MODAL already exists in MaterialProcessing.jsx");
}
