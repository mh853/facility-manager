'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2 } from 'lucide-react'

interface ContractTemplate {
  id: string
  template_name: string
  contract_type: 'subsidy' | 'self_pay'
  supplier_company_name: string
  supplier_representative: string
  supplier_address: string
  terms_and_conditions: string
  is_active: boolean
}

interface ContractTemplateEditorProps {
  isOpen: boolean
  onClose: () => void
  contractType: 'subsidy' | 'self_pay'
  onSave?: () => void
}

export default function ContractTemplateEditor({
  isOpen,
  onClose,
  contractType,
  onSave
}: ContractTemplateEditorProps) {
  const [template, setTemplate] = useState<ContractTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    template_name: '',
    supplier_company_name: '',
    supplier_representative: '',
    supplier_address: '',
    terms_and_conditions: ''
  })

  useEffect(() => {
    if (isOpen) {
      loadTemplate()
    }
  }, [isOpen, contractType])

  const loadTemplate = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/document-automation/contract-template?contract_type=${contractType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success && data.data && data.data.length > 0) {
        const templateData = data.data[0]
        setTemplate(templateData)
        setFormData({
          template_name: templateData.template_name || '',
          supplier_company_name: templateData.supplier_company_name || '',
          supplier_representative: templateData.supplier_representative || '',
          supplier_address: templateData.supplier_address || '',
          terms_and_conditions: templateData.terms_and_conditions || ''
        })
      }
    } catch (error) {
      console.error('Template load error:', error)
      alert('Failed to load template.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!template) {
      alert('Template information not found.')
      return
    }

    if (!confirm('Do you want to modify the template?')) {
      return
    }

    setSaving(true)
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/document-automation/contract-template', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          template_id: template.id,
          ...formData
        })
      })

      const data = await response.json()
      if (data.success) {
        alert('Template has been updated.')
        onSave?.()
        onClose()
      } else {
        alert(data.message || 'Failed to update template.')
      }
    } catch (error) {
      console.error('Template save error:', error)
      alert('An error occurred while saving the template.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            {contractType === 'subsidy' ? 'Subsidy Contract' : 'Self-Pay Contract'} Template Editor
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-blue-500" size={40} />
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={formData.template_name}
                  onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter template name"
                />
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Supplier Information</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={formData.supplier_company_name}
                      onChange={(e) => setFormData({ ...formData, supplier_company_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Supplier company name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Representative
                    </label>
                    <input
                      type="text"
                      value={formData.supplier_representative}
                      onChange={(e) => setFormData({ ...formData, supplier_representative: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Representative name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      value={formData.supplier_address}
                      onChange={(e) => setFormData({ ...formData, supplier_address: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Supplier address"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Contract Terms</h3>
                <textarea
                  value={formData.terms_and_conditions}
                  onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                  rows={15}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="Enter contract terms"
                />
                <p className="mt-2 text-sm text-gray-500">
                  * Line breaks and indentation will be preserved.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Saving...
              </>
            ) : (
              <>
                <Save size={20} />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
