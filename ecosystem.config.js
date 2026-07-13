module.exports = {
    apps: [
        {
            name: 'infinia-rag-backend',
            cwd: '/opt/infinia-rag-demo/backend',
            script: '/opt/infinia-rag-demo/backend/venv/bin/python',
            args: '-m uvicorn main:app --host 0.0.0.0 --port 8003',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '2G',
            env: {
                NODE_ENV: 'production',
                PYTHONUNBUFFERED: '1'
            },
            error_file: '/opt/infinia-rag-demo/logs/backend-error.log',
            out_file: '/opt/infinia-rag-demo/logs/backend-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true
        },
        {
            name: 'infinia-rag-frontend',
            cwd: '/opt/infinia-rag-demo/frontend',
            script: 'npm',
            args: 'run dev -- --host 0.0.0.0 --port 5174',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production'
            },
            error_file: '/opt/infinia-rag-demo/logs/frontend-error.log',
            out_file: '/opt/infinia-rag-demo/logs/frontend-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true
        }
    ]
};
