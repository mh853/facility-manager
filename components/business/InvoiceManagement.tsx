'use client';

import React, { useState, useEffect } from 'react';
import { BusinessInfo } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { AUTH_LEVEL_DESCRIPTIONS } from '@/lib/auth/AuthLevels';

interface InvoiceManagementProps {
  business: BusinessInfo;
  onUpdate: () => void;
}

interface InvoiceCardProps {
  title: string;
  invoiceDate?: string;
  invoiceAmount?: number;
  paymentDate?: string;
  paymentAmount?: number;
  onSave: (data: {
    invoice_date?: string;
    invoice_amount?: number;
    payment_date?: string;
    payment_amount?: number;
  }) => void;
  defaultAmount?: number;
  readOnlyAmount?: boolean;
}

const InvoiceCard: React.FC<InvoiceCardProps> = ({
  title,
  invoiceDate,
  invoiceAmount,
  paymentDate,
  paymentAmount,
  onSave,
  defaultAmount,
  readOnlyAmount = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    invoice_date: invoiceDate || '',
    invoice_amount: invoiceAmount || defaultAmount || 0,
    payment_date: paymentDate || '',
    payment_amount: paymentAmount || 0,
  });

  const receivable = (formData.invoice_amount || 0) - (formData.payment_amount || 0);
  const isFullyPaid = receivable === 0 && formData.invoice_amount > 0;
  const hasInvoice = formData.invoice_date && formData.invoice_amount > 0;

  const handleSave = () => {
    onSave(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      invoice_date: invoiceDate || '',
      invoice_amount: invoiceAmount || defaultAmount || 0,
      payment_date: paymentDate || '',
      payment_amount: paymentAmount || 0,
    });
    setIsEditing(false);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold text-gray-700">{title}</h4>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {hasInvoice ? '수정' : '발행하기'}
          </button>
        )}
      </div>

      {!isEditing ? (
        <div className="space-y-2 text-sm">
          {hasInvoice ? (
            <>
              <div className="flex justify-between">
                <span className="text-gray-600">발행일:</span>
                <span className="font-medium">{formData.invoice_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">발행금액:</span>
                <span className="font-medium">{formData.invoice_amount?.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">입금일:</span>
                <span className="font-medium">{formData.payment_date || '미입금'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">입금금액:</span>
                <span className="font-medium">{formData.payment_amount?.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-300">
                <span className="text-gray-600">미수금:</span>
                <span className={`font-bold ${isFullyPaid ? 'text-green-600' : receivable > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {receivable.toLocaleString()}원 {isFullyPaid ? '✅' : receivable > 0 ? '⚠️' : ''}
                </span>
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-center py-2">미발행</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">발행일</label>
            <input
              type="date"
              value={formData.invoice_date}
              onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">발행금액</label>
            <input
              type="number"
              value={formData.invoice_amount}
              onChange={(e) => setFormData({ ...formData, invoice_amount: Number(e.target.value) })}
              disabled={readOnlyAmount}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm disabled:bg-gray-200"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">입금일</label>
            <input
              type="date"
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">입금금액</label>
            <input
              type="number"
              value={formData.payment_amount}
              onChange={(e) => setFormData({ ...formData, payment_amount: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
            >
              저장
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 px-3 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const InvoiceManagement: React.FC<InvoiceManagementProps> = ({ business, onUpdate }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);

  // 권한 체크 (AuthLevel >= 1)
  const canEdit = user && user.permission_level >= 1;

  useEffect(() => {
    if (business.id) {
      loadInvoiceData();
    }
  }, [business.id]);

  const loadInvoiceData = async () => {
    try {
      const response = await fetch(`/api/business-invoices?business_id=${business.id}`);
      const result = await response.json();

      if (result.success) {
        setInvoiceData(result.data);
      }
    } catch (error) {
      console.error('Error loading invoice data:', error);
    }
  };

  const handleSave = async (
    invoiceType: '1st' | '2nd' | 'additional' | 'advance' | 'balance',
    data: {
      invoice_date?: string;
      invoice_amount?: number;
      payment_date?: string;
      payment_amount?: number;
    }
  ) => {
    if (!canEdit) {
      alert('권한이 없습니다. 일반 이상 권한이 필요합니다.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/business-invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: business.id,
          invoice_type: invoiceType,
          ...data,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('계산서 정보가 업데이트되었습니다');
        await loadInvoiceData();
        onUpdate();
      } else {
        alert(`업데이트 실패: ${result.message}`);
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('저장 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
        <p className="text-yellow-700">계산서 및 입금 정보는 권한 레벨 1 이상만 조회/수정 가능합니다.</p>
      </div>
    );
  }

  if (!invoiceData) {
    return <div className="text-center py-4">로딩 중...</div>;
  }

  const totalReceivables = invoiceData.total_receivables || 0;

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">📊 계산서 및 입금 현황</h3>
        <div className="text-right">
          <p className="text-xs text-gray-500">총 미수금</p>
          <p className={`text-xl font-bold ${totalReceivables > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {totalReceivables.toLocaleString()}원
          </p>
        </div>
      </div>

      {loading && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-4 text-center text-sm text-blue-700">
          처리 중...
        </div>
      )}

      {/* 보조금 사업장 */}
      {business.business_category === '보조금' && invoiceData.invoices && (
        <>
          <InvoiceCard
            title="1차 계산서"
            invoiceDate={invoiceData.invoices.first?.invoice_date}
            invoiceAmount={invoiceData.invoices.first?.invoice_amount}
            paymentDate={invoiceData.invoices.first?.payment_date}
            paymentAmount={invoiceData.invoices.first?.payment_amount}
            onSave={(data) => handleSave('1st', data)}
          />

          <InvoiceCard
            title="2차 계산서"
            invoiceDate={invoiceData.invoices.second?.invoice_date}
            invoiceAmount={invoiceData.invoices.second?.invoice_amount}
            paymentDate={invoiceData.invoices.second?.payment_date}
            paymentAmount={invoiceData.invoices.second?.payment_amount}
            onSave={(data) => handleSave('2nd', data)}
          />

          {business.additional_cost && business.additional_cost > 0 && (
            <InvoiceCard
              title="추가공사비"
              invoiceDate={invoiceData.invoices.additional?.invoice_date}
              invoiceAmount={business.additional_cost}
              paymentDate={invoiceData.invoices.additional?.payment_date}
              paymentAmount={invoiceData.invoices.additional?.payment_amount}
              onSave={(data) => handleSave('additional', data)}
              readOnlyAmount={true}
            />
          )}
        </>
      )}

      {/* 자비 사업장 */}
      {business.business_category === '자비' && invoiceData.invoices && (
        <>
          <InvoiceCard
            title="선금 (기본 50%)"
            invoiceDate={invoiceData.invoices.advance?.invoice_date}
            invoiceAmount={invoiceData.invoices.advance?.invoice_amount}
            paymentDate={invoiceData.invoices.advance?.payment_date}
            paymentAmount={invoiceData.invoices.advance?.payment_amount}
            onSave={(data) => handleSave('advance', data)}
            defaultAmount={0}
          />

          <InvoiceCard
            title="잔금 (기본 50%)"
            invoiceDate={invoiceData.invoices.balance?.invoice_date}
            invoiceAmount={invoiceData.invoices.balance?.invoice_amount}
            paymentDate={invoiceData.invoices.balance?.payment_date}
            paymentAmount={invoiceData.invoices.balance?.payment_amount}
            onSave={(data) => handleSave('balance', data)}
            defaultAmount={0}
          />
        </>
      )}
    </div>
  );
};
