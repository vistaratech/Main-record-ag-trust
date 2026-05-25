const fs = require('fs');
let content = fs.readFileSync('c:/Users/VRED/Desktop/RecordBookMobile/web/src/components/register/SpreadsheetRow.tsx', 'utf-8');

const target1 = `{/* Left padding cell for column virtualization */}
      {paddingLeft > 0 && <td key="pad-left" className="spacer" style={{ width: paddingLeft, minWidth: paddingLeft, padding: 0, border: 'none' }} />}
      {colItems.map((vc) => {`;

const target2 = `          )}
          </div>
        </td>
        );
      })}`;

const p1 = content.indexOf(target1);
const p2 = content.indexOf(target2);

if (p1 > -1 && p2 > -1) {
  const mapBody = content.substring(p1 + target1.length, p2);
  
  const replacement = `{(() => {
        const frozenItems = colItems.filter(vc => frozenColumns?.has(visibleColumns[vc.index]?.id));
        const unfrozenItems = colItems.filter(vc => !frozenColumns?.has(visibleColumns[vc.index]?.id));
        
        const renderCell = (vc: any) => {` + mapBody + `          )}
          </div>
        </td>
        );
        };
        
        return (
          <>
            {frozenItems.map(renderCell)}
            {/* Left padding cell for column virtualization */}
            {paddingLeft > 0 && <td key="pad-left" className="spacer" style={{ width: paddingLeft, minWidth: paddingLeft, padding: 0, border: 'none' }} />}
            {unfrozenItems.map(renderCell)}
          </>
        );
      })()}`;
  
  content = content.substring(0, p1) + replacement + content.substring(p2 + target2.length);
  fs.writeFileSync('c:/Users/VRED/Desktop/RecordBookMobile/web/src/components/register/SpreadsheetRow.tsx', content, 'utf-8');
  console.log('SpreadsheetRow patched');
} else {
  console.log('Targets not found', p1, p2);
}
