'use client';

import React, { useState, useEffect } from 'react';
import { InvoiceFormFields } from './InvoiceFormFields';

interface InvoiceFormInputProps {
  businessId: string;
  businessCategory: '보조금' | '자비';
  additionalCost?: number;
}

export const InvoiceFormInput: React.FC<InvoiceFormInputProps> = ({
  businessId,
  businessCategory,
  additionalCost = 0,
}) => {
  const [invoiceData, setInvoiceData] = useState<any>({
    first: { invoice_date: '', invoice_amount: 0, payment_date: '', payment_amount: 0 },
    second: { invoice_date: '', invoice_amount: 0, payment_date: '', payment_amount: 0 },
    additional: { invoice_date: '', invoice_amount: additionalCost, payment_date: '', payment_amount: 0 },
    advance: { invoice_date: '', invoice_amount: 0, payment_date: '', payment_amount: 0 },
    balance: { invoice_date: '', invoice_amount: 0, payment_date: '', payment_amount: 0 },
  });

  useEffect(() => {
    loadInvoiceData();
  }, [businessId, additionalCost]);

  const loadInvoiceData = async () => {
    try {
      const response = await fetch(`/api/business-invoices?business_id=${businessId}`);
      const result = await response.json();

      if (result.success && result.data.invoices) {
        const invoices = result.data.invoices;
        setInvoiceData({
          first: invoices.first || { invoice_date: '', invoice_amount: 0, payment_date: '', payment_amount: 0 },
          second: invoices.second || { invoice_date: '', invoice_amount: 0, payment_date: '', payment_amount: 0 },
          additional: invoices.additional || { invoice_date: '', invoice_amount: additionalCost, payment_date: '', payment_amount: 0 },
          advance: invoices.advance || { invoice_date: '', invoice_amount: 0, payment_date: '', payment_amount: 0 },
          balance: invoices.balance || { invoice_date: '', invoice_amount: 0, payment_date: '', payment_amount: 0 },
        });
      }
    } catch (error) {
      console.error('Error loading invoice data:', error);
    }
  };

  const handleFieldChange = (type: string, field: string, value: string | number) => {
    setInvoiceData((prev: any) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value,
      },
    }));
  };

  const handleSave = async (type: '1st' | '2nd' | 'additional' | 'advance' | 'balance') => {
    const typeMap: any = {
      '1st': 'first',
      '2nd': 'second',
      'additional': 'additional',
      'advance': 'advance',
      'balance': 'balance',
    };

    const data = invoiceData[typeMap[type]];

    try {
      const response = await fetch('/api/business-invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          invoice_type: type,
          invoice_date: data.invoice_date || null,
          invoice_amount: data.invoice_amount || 0,
          payment_date: data.payment_date || null,
          payment_amount: data.payment_amount || 0,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('저장되었습니다');
        await loadInvoiceData();
      } else {
        alert(`저장 실패: ${result.message}`);
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('저장 중 오류가 발생했습니다');
    }
  };

  return (
    <div className="space-y-4">
      {/* 보조금 사업장 */}
      {businessCategory === '보조금' && (
        <>
          <div className="space-y-2">
            <InvoiceFormFields
              title="1차 계산서"
              formData={invoiceData.first}
              onChange={(field, value) => handleFieldChange('first', field, value)}
            />
            <button
              type="button"
              onClick={() => handleSave('1st')}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              1차 계산서 저장
            </button>
          </div>

          <div className="space-y-2">
            <InvoiceFormFields
              title="2차 계산서"
              formData={invoiceData.second}
              onChange={(field, value) => handleFieldChange('second', field, value)}
            />
            <button
              type="button"
              onClick={() => handleSave('2nd')}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              2차 계산서 저장
            </button>
          </div>

          <div className="space-y-2">
            <InvoiceFormFields
              title={`추가공사비${additionalCost > 0 ? ` (${additionalCost.toLocaleString()}원)` : ''}`}
              formData={{ ...invoiceData.additional, invoice_amount: additionalCost }}
              onChange={(field, value) => handleFieldChange('additional', field, value)}
              readOnlyAmount={true}
            />
            <button
              type="button"
              onClick={() => handleSave('additional')}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              추가공사비 저장
            </button>
          </div>
        </>
      )}

      {/* 자비 사업장 */}
      {businessCategory === '자비' && (
        <>
          <div className="space-y-2">
            <InvoiceFormFields
              title="선금 (기본 50%)"
              formData={invoiceData.advance}
              onChange={(field, value) => handleFieldChange('advance', field, value)}
            />
            <button
              type="button"
              onClick={() => handleSave('advance')}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              선금 저장
            </button>
          </div>

          <div className="space-y-2">
            <InvoiceFormFields
              title="잔금 (기본 50%)"
              formData={invoiceData.balance}
              onChange={(field, value) => handleFieldChange('balance', field, value)}
            />
            <button
              type="button"
              onClick={() => handleSave('balance')}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              잔금 저장
            </button>
          </div>
        </>
      )}
    </div>
  );
};
