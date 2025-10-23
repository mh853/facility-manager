'use client';

import React from 'react';

interface InvoiceDisplayCardProps {
  title: string;
  invoiceDate?: string;
  invoiceAmount?: number;
  paymentDate?: string;
  paymentAmount?: number;
}

export const InvoiceDisplayCard: React.FC<InvoiceDisplayCardProps> = ({
  title,
  invoiceDate,
  invoiceAmount,
  paymentDate,
  paymentAmount,
}) => {
  const receivable = (invoiceAmount || 0) - (paymentAmount || 0);
  const hasInvoice = invoiceDate && invoiceAmount && invoiceAmount > 0;
  const isFullyPaid = receivable === 0 && hasInvoice;

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
      <h4 className="font-semibold text-gray-800 mb-2 text-xs border-b border-gray-200 pb-1.5">
        {title}
      </h4>

      {hasInvoice ? (
        <div className="space-y-1.5 text-xs">
          {/* 발행 정보 */}
          <div className="bg-blue-50 rounded p-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">📄 발행일</span>
              <span className="font-medium text-gray-900">{invoiceDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">💵 발행금액</span>
              <span className="font-semibold text-blue-700">
                {(invoiceAmount || 0).toLocaleString()}원
              </span>
            </div>
          </div>

          {/* 입금 정보 */}
          <div className="bg-green-50 rounded p-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">📅 입금일</span>
              <span className="font-medium text-gray-900">
                {paymentDate || <span className="text-gray-400">미입금</span>}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">💰 입금금액</span>
              <span className="font-semibold text-green-700">
                {(paymentAmount || 0).toLocaleString()}원
              </span>
            </div>
          </div>

          {/* 미수금 */}
          <div className={`rounded p-2 ${
            isFullyPaid ? 'bg-green-100 border border-green-300' :
            receivable > 0 ? 'bg-red-50 border border-red-300' :
            'bg-gray-50 border border-gray-200'
          }`}>
            <div className="flex justify-between items-center">
              <span className="text-gray-700 font-bold">⚖️ 미수금</span>
              <span className={`text-sm font-bold ${
                isFullyPaid ? 'text-green-700' :
                receivable > 0 ? 'text-red-700' :
                'text-gray-700'
              }`}>
                {receivable.toLocaleString()}원
                {isFullyPaid && ' ✅'}
                {receivable > 0 && ' ⚠️'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-gray-400">
          <p className="text-xs">미발행</p>
        </div>
      )}
    </div>
  );
};
