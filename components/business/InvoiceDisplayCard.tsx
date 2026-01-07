'use client';

import React from 'react';
import { formatDate } from '@/utils/formatters';

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
  const hasInvoice = invoiceDate && invoiceAmount && invoiceAmount > 0;  // 발행일이 있어야 계산서로 인정
  const hasPayment = paymentDate && paymentAmount && paymentAmount > 0;
  const hasAnyData = hasInvoice || hasPayment;  // 계산서 또는 입금 중 하나라도 있으면 표시
  const isFullyPaid = receivable === 0 && hasInvoice;

  // 미수금 발생 이유 판단
  const getReceivableReason = () => {
    if (!hasInvoice) return null;
    if (isFullyPaid) return null;
    if (receivable <= 0) return null;

    if (!hasPayment) {
      return '계산서 발행 후 미입금';
    } else if (paymentAmount && paymentAmount < (invoiceAmount || 0)) {
      return `일부 입금 (${((paymentAmount / (invoiceAmount || 1)) * 100).toFixed(0)}%)`;
    }
    return null;
  };

  const receivableReason = getReceivableReason();

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
      <h4 className="font-semibold text-gray-800 mb-2 text-xs border-b border-gray-200 pb-1.5">
        {title}
      </h4>

      {hasAnyData ? (
        <div className="space-y-1.5 text-xs">
          {/* 발행 정보 - 계산서가 있을 때만 표시 */}
          {hasInvoice && (
            <div className="bg-blue-50 rounded p-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">📄 발행일</span>
                <span className="font-medium text-gray-900">{formatDate(invoiceDate || '')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">💵 발행금액</span>
                <span className="font-semibold text-blue-700">
                  {(invoiceAmount || 0).toLocaleString()}원
                </span>
              </div>
            </div>
          )}

          {/* 계산서 없이 입금만 있을 때 안내 메시지 */}
          {!hasInvoice && hasPayment && (
            <div className="bg-yellow-50 rounded p-2 border border-yellow-200">
              <p className="text-xs text-yellow-800">
                ℹ️ 계산서 미발행 (입금만 처리됨)
              </p>
            </div>
          )}

          {/* 입금 정보 */}
          <div className="bg-green-50 rounded p-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">📅 입금일</span>
              <span className="font-medium text-gray-900">
                {paymentDate ? formatDate(paymentDate) : <span className="text-gray-400">미입금</span>}
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

            {/* 미수금 발생 이유 표시 */}
            {receivableReason && (
              <div className="mt-1.5 pt-1.5 border-t border-red-200">
                <p className="text-xs text-red-600">
                  📌 {receivableReason}
                </p>
              </div>
            )}
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
