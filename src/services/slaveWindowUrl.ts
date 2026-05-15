interface BuildSlaveWindowUrlOptions {
  monitorId: string;
  instanceToken: string;
}

const DEFAULT_BASE_PATH = '/';
const SLAVE_WINDOW_FILE = 'slave.html';

export const resolveSlaveWindowPath = (basePath: string = import.meta.env.BASE_URL): string => {
  const safeBasePath = basePath.trim().length > 0 ? basePath.trim() : DEFAULT_BASE_PATH;
  const leadingSlashPath = safeBasePath.startsWith('/') ? safeBasePath : `/${safeBasePath}`;
  const normalizedBasePath = leadingSlashPath.endsWith('/') ? leadingSlashPath : `${leadingSlashPath}/`;

  return `${normalizedBasePath}${SLAVE_WINDOW_FILE}`;
};

export const SLAVE_WINDOW_PATH = resolveSlaveWindowPath();

export const buildSlaveWindowUrl = ({
  monitorId,
  instanceToken
}: BuildSlaveWindowUrlOptions): string => {
  const params = new URLSearchParams({
    monitorId,
    instanceToken
  });

  return `${resolveSlaveWindowPath()}?${params.toString()}`;
};
