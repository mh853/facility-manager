'use client';

import React, { useState, useEffect } from 'react';
import { InvoiceDisplayCard } from './InvoiceDisplayCard';

interface InvoiceDisplayProps {
  businessId: string;
  businessCategory: '보조금' | '자비';
  additionalCost?: number;
}

export const InvoiceDisplay: React.FC<InvoiceDisplayProps> = ({
  businessId,
  businessCategory,
  additionalCost = 0,
}) => {
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvoiceData();
  }, [businessId]);

  const loadInvoiceData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/business-invoices?business_id=${businessId}`);
      const result = await response.json();

      if (result.success) {
        setInvoiceData(result.data);
      }
    } catch (error) {
      console.error('Error loading invoice data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-sm text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!invoiceData) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p className="text-sm">계산서 정보를 불러올 수 없습니다</p>
      </div>
    );
  }

  const totalReceivables = invoiceData.total_receivables || 0;

  return (
    <div className="space-y-3">
      {/* 총 미수금 요약 */}
      <div className={`rounded-lg p-3 border-2 ${
        totalReceivables > 0
          ? 'bg-red-50 border-red-300'
          : 'bg-green-50 border-green-300'
      }`}>
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-gray-700">📊 총 미수금</span>
          <span className={`text-base font-bold ${
            totalReceivables > 0 ? 'text-red-700' : 'text-green-700'
          }`}>
            {totalReceivables.toLocaleString()}원
            {totalReceivables > 0 ? ' ⚠️' : ' ✅'}
          </span>
        </div>
      </div>

      {/* 보조금 사업장 */}
      {businessCategory === '보조금' && invoiceData.invoices && (
        <>
          <InvoiceDisplayCard
            title="1차 계산서"
            invoiceDate={invoiceData.invoices.first?.invoice_date}
            invoiceAmount={invoiceData.invoices.first?.invoice_amount}
            paymentDate={invoiceData.invoices.first?.payment_date}
            paymentAmount={invoiceData.invoices.first?.payment_amount}
          />

          <InvoiceDisplayCard
            title="2차 계산서"
            invoiceDate={invoiceData.invoices.second?.invoice_date}
            invoiceAmount={invoiceData.invoices.second?.invoice_amount}
            paymentDate={invoiceData.invoices.second?.payment_date}
            paymentAmount={invoiceData.invoices.second?.payment_amount}
          />

          {additionalCost && additionalCost > 0 && (
            <InvoiceDisplayCard
              title="추가공사비"
              invoiceDate={invoiceData.invoices.additional?.invoice_date}
              invoiceAmount={additionalCost}
              paymentDate={invoiceData.invoices.additional?.payment_date}
              paymentAmount={invoiceData.invoices.additional?.payment_amount}
            />
          )}
        </>
      )}

      {/* 자비 사업장 */}
      {businessCategory === '자비' && invoiceData.invoices && (
        <>
          <InvoiceDisplayCard
            title="선금 (기본 50%)"
            invoiceDate={invoiceData.invoices.advance?.invoice_date}
            invoiceAmount={invoiceData.invoices.advance?.invoice_amount}
            paymentDate={invoiceData.invoices.advance?.payment_date}
            paymentAmount={invoiceData.invoices.advance?.payment_amount}
          />

          <InvoiceDisplayCard
            title="잔금 (기본 50%)"
            invoiceDate={invoiceData.invoices.balance?.invoice_date}
            invoiceAmount={invoiceData.invoices.balance?.invoice_amount}
            paymentDate={invoiceData.invoices.balance?.payment_date}
            paymentAmount={invoiceData.invoices.balance?.payment_amount}
          />
        </>
      )}
    </div>
  );
};
