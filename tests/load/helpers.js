export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');

export const PRODUCTS = [
  'kb-001', 'kb-002', 'kb-003',
  'ms-001', 'ms-002', 'ms-003',
  'au-001', 'au-002', 'au-003',
  'ac-001', 'ac-002', 'ac-003',
];

export const CATEGORIES = ['keyboards', 'mice', 'audio', 'accessories'];

export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function makeHeaders(sessionId) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Request-ID': uuidv4(),
  };
  if (sessionId) {
    headers['X-Session-ID'] = sessionId;
  }
  return headers;
}

export function sample(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function randomCustomer() {
  const names = [
    'Ada Lovelace', 'Alan Turing', 'Grace Hopper',
    'Linus Torvalds', 'Margaret Hamilton', 'Ken Thompson',
    'Barbara Liskov', 'Donald Knuth', 'Leslie Lamport'
  ];
  const name = sample(names);
  const emailPrefix = name.toLowerCase().replace(/[^a-z]/g, '.');
  return {
    name,
    email: `${emailPrefix}@example.com`,
  };
}

export function randomAddress() {
  const addresses = [
    { line1: '1 Analytical St', line2: 'Suite 400', city: 'London', postalCode: 'N1 9GU', country: 'GB' },
    { line1: '42 Turing Way', line2: '', city: 'Cambridge', postalCode: 'CB2 1TN', country: 'GB' },
    { line1: '101 Binary Ave', line2: 'Apt 2B', city: 'Frankfurt', postalCode: '60311', country: 'DE' },
    { line1: '256 Algorithm Blvd', line2: '', city: 'Berlin', postalCode: '10115', country: 'DE' },
    { line1: '512 Silicon Rd', line2: 'Fl 3', city: 'San Jose', postalCode: '95110', country: 'US' },
    { line1: '1024 Compiler Ct', line2: '', city: 'Austin', postalCode: '78701', country: 'US' },
  ];
  return sample(addresses);
}
