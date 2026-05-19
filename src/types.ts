/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'district' | 'province';

export interface UserSession {
  districtId: string;
  districtName: string;
  role: Role;
}

export interface EventData {
  id?: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  districtId: string;
  districtName: string;
  category: string;
  count?: number;
  budget?: number;
  pic?: string;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}
