'use client';

import React from 'react';

interface InvoiceFormFieldsProps {
  title: string;
  formData: {
    invoice_date?: string;
    invoice_amount?: number;
    payment_date?: string;
    payment_amount?: number;
  };
  onChange: (field: string, value: string | number) => void;
  readOnlyAmount?: boolean;
}

export const InvoiceFormFields: React.FC<InvoiceFormFieldsProps> = ({
  title,
  formData,
  onChange,
  readOnlyAmount = false,
}) => {
  const receivable = (formData.invoice_amount || 0) - (formData.payment_amount || 0);

  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-white">
      <h4 className="font-semibold text-gray-800 mb-3 text-sm">{title}</h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 계산서 발행 */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              발행일
            </label>
            <input
              type="date"
              value={formData.invoice_date || ''}
              onChange={(e) => onChange('invoice_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              발행금액
            </label>
            <input
              type="number"
              value={formData.invoice_amount || 0}
              onChange={(e) => onChange('invoice_amount', Number(e.target.value))}
              disabled={readOnlyAmount}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100"
              placeholder="0"
            />
          </div>
        </div>

        {/* 입금 */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              입금일
            </label>
            <input
              type="date"
              value={formData.payment_date || ''}
              onChange={(e) => onChange('payment_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              입금금액
            </label>
            <input
              type="number"
              value={formData.payment_amount || 0}
              onChange={(e) => onChange('payment_amount', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* 미수금 표시 */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-gray-600">미수금</span>
          <span className={`text-sm font-bold ${
            receivable > 0 ? 'text-red-600' : receivable === 0 && formData.invoice_amount ? 'text-green-600' : 'text-gray-600'
          }`}>
            {receivable.toLocaleString()}원
            {receivable > 0 && ' ⚠️'}
            {receivable === 0 && formData.invoice_amount && formData.invoice_amount > 0 && ' ✅'}
          </span>
        </div>
      </div>
    </div>
  );
};
