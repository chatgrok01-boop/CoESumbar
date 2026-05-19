/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface District {
  id: string;
  name: string;
}

export const DISTRICTS: District[] = [
  { id: 'provinsi', name: 'Dinas Pariwisata Provinsi Sumbar' },
  { id: 'agam', name: 'Kabupaten Agam' },
  { id: 'dharmasraya', name: 'Kabupaten Dharmasraya' },
  { id: 'kep-mentawai', name: 'Kabupaten Kepulauan Mentawai' },
  { id: 'lima-puluh-kota', name: 'Kabupaten Lima Puluh Kota' },
  { id: 'padang-pariaman', name: 'Kabupaten Padang Pariaman' },
  { id: 'pasaman', name: 'Kabupaten Pasaman' },
  { id: 'pasaman-barat', name: 'Kabupaten Pasaman Barat' },
  { id: 'pesisir-selatan', name: 'Kabupaten Pesisir Selatan' },
  { id: 'sijunjung', name: 'Kabupaten Sijunjung' },
  { id: 'solok', name: 'Kabupaten Solok' },
  { id: 'solok-selatan', name: 'Kabupaten Solok Selatan' },
  { id: 'tanah-datar', name: 'Kabupaten Tanah Datar' },
  { id: 'bukittinggi', name: 'Kota Bukittinggi' },
  { id: 'padang', name: 'Kota Padang' },
  { id: 'padang-panjang', name: 'Kota Padang Panjang' },
  { id: 'pariaman', name: 'Kota Pariaman' },
  { id: 'payakumbuh', name: 'Kota Payakumbuh' },
  { id: 'sawahlunto', name: 'Kota Sawahlunto' },
  { id: 'solok-kota', name: 'Kota Solok' },
];

export const CATEGORIES = [
  'Budaya',
  'Kuliner',
  'Olahraga',
  'Musik',
  'Religi',
  'Alam',
  'Lainnya'
];

// In a real app, these would be managed securely. 
// For this demo/simple app, we use simple passcodes as requested.
export const DISTRICT_AUTH: Record<string, string> = {
  'provinsi': 'admin123',
  'agam': 'agam123',
  'dharmasraya': 'dharmasraya123',
  'kep-mentawai': 'mentawai123',
  'lima-puluh-kota': 'limapuluh123',
  'padang-pariaman': 'pariaman123',
  'pasaman': 'pasaman123',
  'pasaman-barat': 'pasbar123',
  'pesisir-selatan': 'pessel123',
  'sijunjung': 'sijunjung123',
  'solok': 'solok123',
  'solok-selatan': 'solsel123',
  'tanah-datar': 'tanahdatar123',
  'bukittinggi': 'bukittinggi123',
  'padang': 'padang123',
  'padang-panjang': 'padangpanjang123',
  'pariaman': 'pariaman123',
  'payakumbuh': 'payakumbuh123',
  'sawahlunto': 'sawahlunto123',
  'solok-kota': 'solokkota123',
};
