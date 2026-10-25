const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');

const project = new Project({
    tsConfigFilePath: path.join(__dirname, '../tsconfig.json')
});

const files = project.getSourceFiles();

files.forEach(sourceFile => {
    // Only process files in app, context, hooks
    const filePath = sourceFile.getFilePath();
    if (!filePath.includes('/app/') && !filePath.includes('/context/') && !filePath.includes('/hooks/') && !filePath.includes('/components/')) {
        return;
    }

    let hasChanges = false;
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    
    for (const callExpr of callExpressions) {
        // Since nodes might have been removed or become invalid, we check if it's still valid
        if (callExpr.wasForgotten()) continue;
        
        const expression = callExpr.getExpression();
        if (expression && expression.getKind() === SyntaxKind.PropertyAccessExpression) {
            const text = expression.getText();
            if (text === 'console.log') {
                const catchClause = callExpr.getFirstAncestorByKind(SyntaxKind.CatchClause);
                if (!catchClause) {
                    const parent = callExpr.getParent();
                    if (parent && parent.getKind() === SyntaxKind.ExpressionStatement) {
                        try {
                            parent.remove();
                            hasChanges = true;
                        } catch(e) {
                            console.error('Error removing expression statement', e);
                        }
                    } else {
                        try {
                            callExpr.remove();
                            hasChanges = true;
                        } catch(e) {
                            console.error('Error removing call expression', e);
                        }
                    }
                }
            }
        }
    }

    if (hasChanges) {
        sourceFile.saveSync();
        console.log(`Updated ${filePath}`);
    }
});
