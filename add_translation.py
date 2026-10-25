import os
import re
import sys

def slugify(text):
    text = text.strip().lower()
    text = re.sub(r'[^a-z0-9]+', '_', text)
    text = text.strip('_')
    return text[:20]

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content
    
    if "useTranslation" not in content:
        # Add import
        import_stmt = "import { useTranslation } from 'react-i18next';\n"
        if "import React" in content:
            content = re.sub(r"(import React[^;\n]*;?\n)", r"\1" + import_stmt, content, 1)
        elif "import {" in content:
            content = import_stmt + content

    def replace_text(match):
        full_match = match.group(0)
        prefix = match.group(1)
        inner_text = match.group(2)
        suffix = match.group(3)
        
        # Skip if already translated or has curly braces
        if "{" in inner_text or "}" in inner_text or "t(" in inner_text:
            return full_match
            
        stripped = inner_text.strip()
        if not stripped:
            return full_match
            
        slug = slugify(stripped)
        if not slug:
            return full_match
            
        # Also need to handle single quotes in inner_text
        safe_text = stripped.replace("'", "\\'")
        
        # Replace the inner text with {t('slug', 'text')}
        # Keep leading/trailing whitespace
        leading_ws = inner_text[:len(inner_text) - len(inner_text.lstrip())]
        trailing_ws = inner_text[len(inner_text.rstrip()):]
        
        replacement = f"{leading_ws}{{t('{slug}', '{safe_text}')}}{trailing_ws}"
        return f"{prefix}{replacement}{suffix}"

    # Replace <Text>something</Text> or <Text style={...}>something</Text>
    # Group 1: <Text ... >
    # Group 2: inner text
    # Group 3: </Text>
    pattern = re.compile(r'(<Text[^>]*>)([^<]+)(</Text>)')
    content = pattern.sub(replace_text, content)
    
    # Also do it for strings in stats array like: title: "TODAY'S RECEIPTS"
    # Actually, those are too specific, might need a more targeted regex or leave for now.

    # Check if we need to add const { t } = useTranslation();
    if "const { t }" not in content and "useTranslation" in content:
        # Find default export function
        func_match = re.search(r'(export default function [a-zA-Z0-9_]+\s*\([^\)]*\)\s*\{)', content)
        if func_match:
            insert_pos = func_match.end()
            content = content[:insert_pos] + "\n    const { t } = useTranslation();" + content[insert_pos:]

    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"No changes for {filepath}")

if __name__ == "__main__":
    for f in sys.argv[1:]:
        process_file(f)
