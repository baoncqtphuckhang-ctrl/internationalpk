const fs = require('fs');
const filePath = 'components/MaterialOrder.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const printFunc = `
    const renderPrintLayout = (data) => {
        const categoriesToRender = (Array.isArray(data.items) ? data.items : DEFAULT_CATEGORIES).map(cat => ({
            ...cat,
            items: (data.isCreate ? cat.items : cat.items.filter(item => (parseFloat(item.quantity) || 0) > 0))
        })).filter(cat => cat.items.length > 0);

        return (
            <div className="print-area bg-white font-['Times_New_Roman',_serif] text-[16px] text-black w-full max-w-[800px] flex flex-col mx-auto py-10 print:py-0 print:m-0">
                <div className="text-center mb-8 mt-4">
                    <h1 className="font-bold text-xl uppercase tracking-wider leading-normal">
                        ĐƠN ĐẶT HÀNG VẬT TƯ - {data.order_phase?.toUpperCase() || ''}
                    </h1>
                </div>

                <div className="mb-8 space-y-3 text-[16px] pl-10 pr-10">
                    <div className="flex gap-2">
                        <span className="uppercase w-40 shrink-0">DỰ ÁN :</span>
                        <span className="uppercase break-words">{data.project_name}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="uppercase w-40 shrink-0">ĐỊA CHỈ :</span>
                        <span className="uppercase break-words">{data.address}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="uppercase w-40 shrink-0">HẠNG MỤC :</span>
                        <span className="uppercase break-words">{data.category}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="uppercase w-40 shrink-0">CÔNG TY :</span>
                        <span className="uppercase break-words">{data.company || 'CÔNG TY CỔ PHẦN ĐẦU TƯ XÂY DỰNG BCONS'}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="uppercase w-40 shrink-0">NGƯỜI NHẬN HÀNG :</span>
                        <span className="uppercase break-words">{data.recipient}</span>
                    </div>
                </div>

                <div className="overflow-x-auto print:overflow-visible px-10">
                    <table className="w-full border-collapse border border-black min-w-0">
                        <thead>
                            <tr className="text-black bg-transparent">
                                <th className="border border-black p-2 text-center w-16 font-bold text-[16px]">STT</th>
                                <th className="border border-black p-2 text-center font-bold text-[16px]">Chủng loại vật tư</th>
                                <th className="border border-black p-2 text-center w-32 font-bold text-[16px]">ĐVT</th>
                                <th className="border border-black p-2 text-center w-32 font-bold text-[16px]">Số lượng</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categoriesToRender.map((cat, catIdx) => (
                                <React.Fragment key={catIdx}>
                                    <tr>
                                        <td colSpan="4" className="border border-black p-2 text-center font-bold text-[16px] text-black bg-transparent">
                                            {cat.name}
                                        </td>
                                    </tr>
                                    {cat.items.map((item, itemIdx) => (
                                        <tr key={itemIdx}>
                                            <td className="border border-black p-2 text-center text-[16px] font-medium">{item.stt}</td>
                                            <td className="border border-black p-2 pl-4 text-[16px]">
                                                {item.name} {item.colorCode ? \`(\${item.colorCode})\` : ''}
                                            </td>
                                            <td className="border border-black p-2 text-center text-[16px]">{item.unit}</td>
                                            <td className="border border-black p-2 text-right pr-4 text-[16px]">
                                                {item.quantity || ''}
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-8 flex justify-end font-['Times_New_Roman',_serif] pr-10">
                    <div className="text-center w-80 space-y-2">
                        <p className="text-[16px] text-black">
                            NGÀY {getVietnameseDateComponents(data.order_date || new Date().toISOString()).day} THÁNG {getVietnameseDateComponents(data.order_date || new Date().toISOString()).month} NĂM {getVietnameseDateComponents(data.order_date || new Date().toISOString()).year}
                        </p>
                        <p className="font-bold text-[16px] text-black">NGƯỜI LẬP</p>
                        {(() => {
                            const creatorUsername = data.created_by || currentUser?.username;
                            const creatorUser = usersList?.find(u => u.username === creatorUsername);
                            const signatureUrl = creatorUser?.signature_url;
                            
                            return (
                                <>
                                    <div className="h-24 flex items-center justify-center">
                                        {data.show_signature !== false && signatureUrl ? (
                                            <img src={signatureUrl} className="max-h-20 object-contain opacity-90" style={{ mixBlendMode: 'multiply', filter: 'contrast(1.2)' }} alt="Chữ ký" />
                                        ) : (
                                            <div className="text-slate-300 italic text-sm"></div>
                                        )}
                                    </div>
                                    <p className="font-bold text-[16px] text-black uppercase mt-2">
                                        {creatorUser?.full_name || creatorUsername || 'QUẢN TRỊ HỆ THỐNG'}
                                    </p>
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>
        );
    };
`;

// Insert the function
content = content.replace("const handleSave = async (e) => {", printFunc + "\n    const handleSave = async (e) => {");

// Replace detail print area
const detailPattern = /\{\/\* DỰ ÁN PREVIEW SIMULATOR \*\/\}\s*<div className="print-area[\s\S]*?\{\/\* SIGNATURE BLOCK \*\/\}\s*<div className="mt-12[\s\S]*?<\/div>\s*<\/div>/;
content = content.replace(detailPattern, `
                        {/* DỰ ÁN PREVIEW SIMULATOR */}
                        <div className="shadow-2xl rounded-sm w-full max-w-[950px] mx-auto border border-slate-200 print:border-none print:shadow-none bg-white">
                            {renderPrintLayout({ ...selectedOrder, items: selectedOrder.items, isCreate: false })}
                        </div>
`);

// Add print class to create form
content = content.replace('<form onSubmit={handleSave} className="space-y-6">', '<form onSubmit={handleSave} className="space-y-6 print:hidden">');

// Add print-only block to create view
const createPrintInsertionPattern = /\{\/\* FORM ACTIONS \*\/\}/;
content = content.replace(createPrintInsertionPattern, `
                        {/* PRINT ONLY LAYOUT */}
                        <div className="hidden print:block w-full">
                            {renderPrintLayout({ ...formData, items: formData.categories, isCreate: true })}
                        </div>

                        {/* FORM ACTIONS */}`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated print layout');
