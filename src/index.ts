interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * College Scorecard MCP — US Department of Education College Scorecard API
 *
 * BYO key: requires a free api.data.gov API key from https://api.data.gov/signup/
 * Passed via _apiKey parameter.
 *
 * Tools:
 * - search_schools: search colleges/universities by name, state, or both
 * - get_school: get detailed info for a school by its College Scorecard ID
 */


const BASE_URL = 'https://api.data.gov/ed/collegescorecard/v1';

// --- Helpers ---

function extractKey(args: Record<string, unknown>): string {
  const key = args._apiKey as string;
  delete args._apiKey;
  if (!key) throw new Error('College Scorecard API key required. Get one free at https://api.data.gov/signup/ and pass via _apiKey.');
  return key;
}

// --- Raw API types ---

type RawSchool = {
  id?: number | null;
  'school.name'?: string | null;
  'school.city'?: string | null;
  'school.state'?: string | null;
  'school.zip'?: string | null;
  'school.school_url'?: string | null;
  'school.ownership'?: number | null;
  'school.locale'?: number | null;
  'school.carnegie_basic'?: number | null;
  'latest.student.size'?: number | null;
  'latest.admissions.admission_rate.overall'?: number | null;
  'latest.cost.tuition.in_state'?: number | null;
  'latest.cost.tuition.out_of_state'?: number | null;
  'latest.earnings.10_yrs_after_entry.median'?: number | null;
  'latest.completion.rate_suppressed.overall'?: number | null;
  'latest.aid.median_debt.completers.overall'?: number | null;
  'latest.programs.cip4_digit'?: { code?: string; title?: string }[] | null;
};

type SearchResponse = {
  metadata?: { total?: number; page?: number; per_page?: number } | null;
  results?: RawSchool[];
};

const OWNERSHIP_MAP: Record<number, string> = {
  1: 'Public',
  2: 'Private nonprofit',
  3: 'Private for-profit',
};

// --- Formatters ---

function formatSchool(s: RawSchool) {
  return {
    id: s.id ?? null,
    name: s['school.name'] ?? null,
    city: s['school.city'] ?? null,
    state: s['school.state'] ?? null,
    zip: s['school.zip'] ?? null,
    url: s['school.school_url'] ?? null,
    ownership: s['school.ownership'] != null ? (OWNERSHIP_MAP[s['school.ownership']] ?? String(s['school.ownership'])) : null,
    student_size: s['latest.student.size'] ?? null,
    admission_rate: s['latest.admissions.admission_rate.overall'] ?? null,
    tuition_in_state: s['latest.cost.tuition.in_state'] ?? null,
    tuition_out_of_state: s['latest.cost.tuition.out_of_state'] ?? null,
    median_earnings_10yr: s['latest.earnings.10_yrs_after_entry.median'] ?? null,
    completion_rate: s['latest.completion.rate_suppressed.overall'] ?? null,
    median_debt: s['latest.aid.median_debt.completers.overall'] ?? null,
  };
}

// --- Tool definitions ---

const FIELDS = [
  'id',
  'school.name',
  'school.city',
  'school.state',
  'school.zip',
  'school.school_url',
  'school.ownership',
  'latest.student.size',
  'latest.admissions.admission_rate.overall',
  'latest.cost.tuition.in_state',
  'latest.cost.tuition.out_of_state',
  'latest.earnings.10_yrs_after_entry.median',
  'latest.completion.rate_suppressed.overall',
  'latest.aid.median_debt.completers.overall',
].join(',');

const tools: McpToolExport['tools'] = [
  {
    name: 'search_schools',
    description:
      'Search US colleges and universities by name. Returns school name, location, tuition, admission rate, student size, median earnings, and completion rate. Example: search_schools("MIT", "MA").',
    inputSchema: {
      type: 'object',
      properties: {
        _apiKey: { type: 'string', description: 'api.data.gov API key' },
        query: { type: 'string', description: 'School name to search for (e.g., "Stanford", "community college")' },
        state: { type: 'string', description: 'Two-letter state code to filter (e.g., "CA", "NY")' },
        limit: { type: 'number', description: 'Number of results to return (default: 10, max: 100)' },
      },
      required: ['_apiKey', 'query'],
    },
  },
  {
    name: 'get_school',
    description:
      'Get detailed info for a specific college by its College Scorecard ID. Returns tuition, admission rate, student size, median earnings after 10 years, completion rate, and median debt.',
    inputSchema: {
      type: 'object',
      properties: {
        _apiKey: { type: 'string', description: 'api.data.gov API key' },
        id: { type: 'number', description: 'College Scorecard school ID (numeric, from search results)' },
      },
      required: ['_apiKey', 'id'],
    },
  },
];

// --- callTool dispatcher ---

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const key = extractKey(args);

  switch (name) {
    case 'search_schools':
      return searchSchools(key, args.query as string, args.state as string | undefined, (args.limit as number) ?? 10);
    case 'get_school':
      return getSchool(key, args.id as number);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// --- Tool implementations ---

async function searchSchools(apiKey: string, query: string, state?: string, limit?: number) {
  const count = Math.min(Math.max(1, limit ?? 10), 100);
  const params = new URLSearchParams({
    'school.name': query,
    fields: FIELDS,
    per_page: String(count),
    api_key: apiKey,
  });
  if (state) params.set('school.state', state.toUpperCase());

  const res = await fetch(`${BASE_URL}/schools?${params}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`College Scorecard API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as SearchResponse;

  return {
    query,
    state: state?.toUpperCase() ?? null,
    total: data.metadata?.total ?? 0,
    returned: (data.results ?? []).length,
    schools: (data.results ?? []).map(formatSchool),
  };
}

async function getSchool(apiKey: string, id: number) {
  const params = new URLSearchParams({
    fields: FIELDS,
    api_key: apiKey,
  });

  const res = await fetch(`${BASE_URL}/schools/${id}?${params}`);
  if (res.status === 404) throw new Error(`No school found with ID: ${id}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`College Scorecard API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as SearchResponse;
  const school = data.results?.[0];
  if (!school) throw new Error(`No school found with ID: ${id}`);

  return formatSchool(school);
}

export default { tools, callTool, meter: { credits: 5 } } satisfies McpToolExport;
