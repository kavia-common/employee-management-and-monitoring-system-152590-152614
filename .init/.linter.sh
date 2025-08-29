#!/bin/bash
cd /home/kavia/workspace/code-generation/employee-management-and-monitoring-system-152590-152614/express_backend
npm run lint
LINT_EXIT_CODE=$?
if [ $LINT_EXIT_CODE -ne 0 ]; then
  exit 1
fi

