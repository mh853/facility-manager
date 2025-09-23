import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '관리자 - 시설 관리 시스템',
  description: '시설 관리 시스템 관리자 페이지',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}