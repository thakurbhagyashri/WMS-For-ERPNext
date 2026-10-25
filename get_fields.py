import frappe
from frappe import _

def get_fields():
    meta = frappe.get_meta('Pick List Item')
    return [f.fieldname for f in meta.fields]

print(get_fields())
