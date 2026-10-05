const fs = require('fs');

const pageFile = 'app/page.js';
let pageContent = fs.readFileSync(pageFile, 'utf8');

// 1. Add state variable
if (!pageContent.includes('const [materialActionOrder, setMaterialActionOrder] = useState(null);')) {
    pageContent = pageContent.replace(
        "const [materialSubTab, setMaterialSubTab] = useState('order');",
        "const [materialSubTab, setMaterialSubTab] = useState('order');\n    const [materialActionOrder, setMaterialActionOrder] = useState(null);"
    );
}

// 2. Pass props to MaterialProcessing
pageContent = pageContent.replace(
    /<MaterialProcessing\s+currentUser=\{currentUser\}\s+projects=\{allowedProjects\}\s+showToast=\{showToast\}\s+\/>/,
    `<MaterialProcessing 
                                currentUser={currentUser} 
                                projects={allowedProjects} 
                                showToast={showToast} 
                                onNavigateToEdit={(order) => {
                                    setMaterialActionOrder({ order, action: 'edit' });
                                    setMaterialSubTab('order');
                                }}
                                onNavigateToDetail={(order) => {
                                    setMaterialActionOrder({ order, action: 'detail' });
                                    setMaterialSubTab('order');
                                }}
                            />`
);

// 3. Pass props to MaterialOrder
pageContent = pageContent.replace(
    /<MaterialOrder\s+currentUser=\{currentUser\}\s+usersList=\{usersList\}\s+projects=\{allowedProjects\}\s+realtimeVersion=\{realtimeVersion\}\s+\/>/,
    `<MaterialOrder 
                                    currentUser={currentUser} 
                                    usersList={usersList} 
                                    projects={allowedProjects} 
                                    realtimeVersion={realtimeVersion}
                                    actionOrder={materialActionOrder}
                                    onActionComplete={() => setMaterialActionOrder(null)}
                                />`
);

fs.writeFileSync(pageFile, pageContent, 'utf8');

const orderFile = 'components/MaterialOrder.jsx';
let orderContent = fs.readFileSync(orderFile, 'utf8');

// Add props
orderContent = orderContent.replace(
    'export default function MaterialOrder({ currentUser, usersList, projects, showToast, onCreateAccountingRequest, dnttList, onUpdateAccountingRequest, realtimeVersion }) {',
    'export default function MaterialOrder({ currentUser, usersList, projects, showToast, onCreateAccountingRequest, dnttList, onUpdateAccountingRequest, realtimeVersion, actionOrder, onActionComplete }) {'
);

// Add useEffect
const useEffectStr = `
    useEffect(() => {
        if (actionOrder) {
            if (actionOrder.action === 'edit') {
                setView('create');
                setSelectedOrder(actionOrder.order);
            } else if (actionOrder.action === 'detail') {
                setView('detail');
                setSelectedOrder(actionOrder.order);
            }
            if (onActionComplete) onActionComplete();
        }
    }, [actionOrder]);
`;

orderContent = orderContent.replace(
    "const [view, setView] = useState('list'); // 'list', 'create', 'detail'",
    "const [view, setView] = useState('list'); // 'list', 'create', 'detail'\n" + useEffectStr
);

fs.writeFileSync(orderFile, orderContent, 'utf8');

console.log("Updated page.js and MaterialOrder.jsx");
