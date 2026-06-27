const fs = require('fs');
const file = 'components/EmployeeSalary.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Wrap lines 1316 to 1628 in a function
const startTag = '<div className={`overflow-x-auto custom-scrollbar pb-4`} style={{ maxHeight: \'calc(100vh - 200px)\' }}>';
const endTag = '</div>\n            )}';

const startIndex = content.indexOf(startTag);
const nextSection = `{activeTab === 'attendance' && (`;
const endIndex = content.indexOf(nextSection);

if (startIndex === -1 || endIndex === -1) {
    console.log('Error: tags not found');
    process.exit(1);
}

// Find exactly the end of the block before nextSection
const tableContentRaw = content.substring(startIndex, endIndex);
// Actually, let's just find the `            </div>\n            )}\n            \n            {activeTab === 'attendance' && (`
const endMatch = '            </div>\n            )}\n            \n            {activeTab === \'attendance\'';
const exactEndIndex = content.indexOf(endMatch);

if (exactEndIndex === -1) {
    console.log('Error: exact end not found');
    process.exit(1);
}

// We extract everything from `<div className=...>` down to the `            </div>`
// The `            )}` belongs to the `activeTab === 'history' ? ... : (...)` ternary!
// So if we extract from `<div...>` to `</div>`, we get exactly the table block.
const blockEndTag = '</div>';
const exactEndOfDiv = content.lastIndexOf(blockEndTag, exactEndIndex + 18) + 6;

const tableContent = content.substring(startIndex, exactEndOfDiv);

// 2. We replace that section with conditional rendering
let newTableContent = `const renderTableContent = () => (\n` + tableContent.replace(/^            /gm, '    ') + `\n);\n\n            {activeTab !== 'history' && renderTableContent()}\n\n`;

// 3. Now we modify the history accordion
const historyBlockStart = `{activeTab === 'history' ? (\n                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 min-h-[400px]">`;
const historyBlockStartNew = `{activeTab === 'history' && (\n                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 min-h-[400px]">`;

let finalContent = content.substring(0, startIndex) + newTableContent + content.substring(exactEndOfDiv);
finalContent = finalContent.replace(historyBlockStart, historyBlockStartNew);

// Remove the ') : (' part of the ternary that was wrapped around the table
const elsePart = `            ) : (\n            const renderTableContent`;
finalContent = finalContent.replace(elsePart, `            )}\n            const renderTableContent`);

// Also fix if it didn't match exactly because of spaces
finalContent = finalContent.replace(/\) : \(\s+const renderTableContent/, `)}\n            const renderTableContent`);


// 4. Update the history map
const historyMapOld = `{Object.entries(historyRecords).sort((a,b) => b[0].localeCompare(a[0])).map(([monthId, data]) => (
                                <div key={monthId} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition">
                                    <div className="flex items-center justify-between mb-4">`;

const historyMapNew = `{Object.entries(historyRecords).sort((a,b) => b[0].localeCompare(a[0])).map(([monthId, data]) => {
                                const isExpanded = viewingHistoryId === monthId;
                                return (
                                <div key={monthId} className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden transition">
                                    <div className={\`flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition \${isExpanded ? 'bg-slate-50 border-b border-slate-200' : ''}\`} onClick={() => {
                                        if (isExpanded) {
                                            setViewingHistoryId(null);
                                            const drafts = getDraftPeriods();
                                            setSelectedMonth(drafts.length > 0 ? drafts[0] : '');
                                        } else {
                                            setViewingHistoryId(monthId);
                                            setSelectedMonth(monthId);
                                        }
                                    }}>`;

finalContent = finalContent.replace(historyMapOld, historyMapNew);

// Replace the end of the history card
const cardEndOld = `<Save size={16} /> Tạo Phiếu Chi Lương
                                    </button>
                                </div>
                            ))`;

const cardEndNew = `<Save size={16} /> Tạo Phiếu Chi
                                    </button>
                                    {isExpanded && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSystemModal({
                                                    isOpen: true,
                                                    type: 'warning',
                                                    title: 'Hoàn tác kỳ lương',
                                                    message: \`Bạn có chắc muốn HOÀN TÁC kỳ lương \${monthId} về trạng thái Nháp không? Dữ liệu lịch sử sẽ bị xóa nhưng bảng tính vẫn giữ nguyên.\`,
                                                    onConfirm: () => handleDeleteHistory(monthId)
                                                });
                                            }}
                                            className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold px-4 py-2 rounded-lg text-sm transition flex items-center justify-center gap-2"
                                            title="Đưa kỳ này về trạng thái nháp"
                                        >
                                            Hoàn tác
                                        </button>
                                    )}
                                </div>
                                {isExpanded && (
                                    <div className="bg-white" onClick={(e) => e.stopPropagation()}>
                                        {renderTableContent()}
                                    </div>
                                )}
                                </div>
                                );
                            })`;
finalContent = finalContent.replace(cardEndOld, cardEndNew);

// Also remove the "Xem" button since the whole header is clickable
const xemButtonOld = `<button onClick={() => handleViewHistory(monthId)} className="bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold px-4 py-2 rounded-lg text-sm transition">
                                                Xem
                                            </button>`;
finalContent = finalContent.replace(xemButtonOld, '');

const deleteHistoryOld = `<button onClick={() => handleDeleteHistory(monthId)} className="bg-red-50 hover:bg-red-100 text-red-600 font-bold p-2 rounded-lg transition" title="Xóa dữ liệu">
                                                <Trash2 size={16} />
                                            </button>`;
finalContent = finalContent.replace(deleteHistoryOld, '');

// Fix 'Tạo phiếu chi' button
const taoPhieuChiOld = `</div>
                                    <button 
                                        onClick={() => setSalaryTxModal({ isOpen: true, monthId, data, selectedProject: projects?.[0]?.name || '' })} 
                                        className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-2 rounded-lg text-sm transition flex items-center justify-center gap-2"
                                    >`;

const taoPhieuChiNew = `<button 
                                        onClick={(e) => { e.stopPropagation(); setSalaryTxModal({ isOpen: true, monthId, data, selectedProject: projects?.[0]?.name || '' }); }} 
                                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-4 py-2 rounded-lg text-sm transition flex items-center justify-center gap-2"
                                    >`;

finalContent = finalContent.replace(taoPhieuChiOld, taoPhieuChiNew);

fs.writeFileSync(file, finalContent);
console.log('Refactored successfully');
