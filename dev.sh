#!/usr/bin/env bash
# Development and deployment helper script
# Usage: ./dev.sh [command ...]

set -o pipefail

# Source fancy output library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/fancy.sh"

# Determine if running on GitHub Actions
GITHUB_ACTIONS_RUN="false"
if [ -n "${GITHUB_ACTIONS:-}" ]; then
  GITHUB_ACTIONS_RUN="true"
fi

load_env() {
  if [ "$GITHUB_ACTIONS_RUN" = "true" ]; then
    echo "Running on GitHub Actions. Executing CI-specific commands."
    echo "Loading .env files from GitHub Secrets..."
  else
    echo "Not running on GitHub Actions. Executing local commands."
    if [ ! -f .env ]; then
      echo "✘ .env file not found! Please create a .env file with ./dev.sh new"
      exit 1
    else
      echo "✔ .env file found."
      # Export variables from .env so subsequent commands can use them
      set -a
      # shellcheck disable=SC1091
      . ./.env
      set +a
    fi
  fi
}

cmd_env() {
  load_env
}

cmd_login() {
  load_env
  cmd_docker
  cmd_ec2
}

cmd_docker() {
  load_env
  echo "Authenticating Docker Hub credentials..."
  echo "${DOCKER_PAT}" | docker login -u "${DOCKER_USERNAME}" --password-stdin > /dev/null 2>&1 || {
    echo "✘ Docker Hub authentication failed."
    exit 1
  }
  echo "✔ Docker Hub authentication successful."
}

cmd_ssh() {
  load_env
  ssh -i "${HOME}/.ssh/${EC2_KEY_NAME}" "ubuntu@${EC2_DEPLOY_HOST}"
}

cmd_ec2() {
  load_env
  echo "Validating EC2 connection..."
  chmod 400 "${HOME}/.ssh/${EC2_KEY_NAME}"
  ssh -o StrictHostKeyChecking=no -i "${HOME}/.ssh/${EC2_KEY_NAME}" "ubuntu@${EC2_DEPLOY_HOST}" 'echo "EC2 connection successful."' > /dev/null 2>&1 || {
    echo "✘ EC2 connection failed."
    exit 1
  }
  echo "✔ EC2 connection successful."
  echo "Checking other environment variables..."
  if [ -z "${APP_VERSION:-}" ] || [ -z "${APP_NAME:-}" ] || [ -z "${EC2_DEPLOY_DIR:-}" ]; then
    echo "✘ APP_VERSION, APP_NAME, and EC2_DEPLOY_DIR must be set in .env file."
    exit 1
  else
    echo "APP_NAME: ${APP_NAME}"
    echo "APP_VERSION: ${APP_VERSION}"
    echo "EC2_DEPLOY_DIR: ${EC2_DEPLOY_DIR}"
    echo "✔ All required environment variables are set."
  fi
}

cmd_init() {
  load_env
  echo "Initializing production setup..."
  sed -e "s|__DOCKER_USERNAME__|${DOCKER_USERNAME}|g" \
      -e "s|__APP_VERSION__|${APP_VERSION}|g" \
      -e "s|__APP_NAME__|${APP_NAME}|g" \
      docker-compose-template.yml > docker-compose.yml
  echo "Generated docker-compose.yml from template."
}

cmd_up() {
  load_env
  docker compose up --build
}

cmd_down() {
  load_env
  docker compose down
}

cmd_build() {
  load_env
  docker compose build --no-cache
}

cmd_push() {
  load_env
  docker compose push
}

cmd_deploy() {
  load_env
  echo "Deploying to EC2 instance at ${EC2_DEPLOY_HOST}..."
  ssh -i "${HOME}/.ssh/${EC2_KEY_NAME}" "ubuntu@${EC2_DEPLOY_HOST}" "mkdir -p ${EC2_DEPLOY_DIR}"
  scp -i "${HOME}/.ssh/${EC2_KEY_NAME}" docker-compose.yml "ubuntu@${EC2_DEPLOY_HOST}:${EC2_DEPLOY_DIR}/docker-compose.yml"
  ssh -i "${HOME}/.ssh/${EC2_KEY_NAME}" "ubuntu@${EC2_DEPLOY_HOST}" "cd ${EC2_DEPLOY_DIR} && docker compose pull && docker compose up -d --remove-orphans"
  echo "Deployment complete. Access your application at:"
  echo "http://${EC2_DEPLOY_HOST}"
}

cmd_install() {
  load_env
  echo "Installing web app on EC2 instance..."
  docker compose up -d --remove-orphans
}

cmd_logs() {
  load_env
  ssh -i "${HOME}/.ssh/${EC2_KEY_NAME}" "ubuntu@${EC2_DEPLOY_HOST}" "cd ${EC2_DEPLOY_DIR} && docker compose logs -f"
}

cmd_web() {
  load_env
  local url="http://${EC2_DEPLOY_HOST}"
  echo "$url"
}

cmd_open_web() {
  load_env
  local url="http://${EC2_DEPLOY_HOST}"
  echo "Opening $url in browser..."
  if command -v open &> /dev/null; then
    open "$url"
  elif command -v xdg-open &> /dev/null; then
    xdg-open "$url"
  else
    echo "Could not find 'open' or 'xdg-open' command. Please open manually: $url"
  fi
}

cmd_clean() {
  rm -rf ./data/
  (cd app && npm run clean)
}

cmd_nuke() {
  echo "⚠️  NUKE WARNING: This will remove ALL local configuration and Docker resources!"
  echo ""
  echo "This command will:"
  echo "  • Remove .env file"
  echo "  • Remove docker-compose.yml"
  echo "  • Remove ec2-ssh.sh"
  echo "  • Stop and remove all Docker containers, images, volumes"
  echo "  • Delete local data directory"
  echo ""
  echo "Type 'nuke' to confirm (or anything else to cancel):"
  read -r confirmation
  if [ "$confirmation" != "nuke" ]; then
    echo "✔ Nuke cancelled."
    return 0
  fi

  echo ""
  echo "🔥 Nuking everything..."

  # Stop and remove Docker resources
  docker compose down --rmi all --volumes --remove-orphans 2>/dev/null || true

  # Remove generated files
  rm -f .env
  rm -f docker-compose.yml
  rm -f ec2-ssh.sh

  # Remove data
  rm -rf ./data/

  # Clean app directory
  (cd app && npm run clean 2>/dev/null || true)

  echo "✔ Nuke complete. Everything removed."
  echo ""
  echo "To start fresh, run: ./dev.sh new"
}

cmd_nuke_server() {
  load_env
  echo "⚠️  NUKE WARNING: This will remove ALL server configuration and Docker resources!"
  echo ""
  echo "This command will:"
  echo "  • Stop and remove all Docker containers, images, volumes"
  echo ""
  echo "Type 'nuke_server' to confirm (or anything else to cancel):"
  read -r confirmation
  if [ "$confirmation" != "nuke_server" ]; then
    echo "✔ Nuke cancelled."
    return 0
  fi

  echo ""
  echo "🔥 Nuking server..."

  # Stop and remove Docker resources
  ssh -vvv -i "${HOME}/.ssh/${EC2_KEY_NAME}" "ubuntu@${EC2_DEPLOY_HOST}" "docker ps -aq | xargs docker stop && docker ps -aq | xargs docker rm" >/dev/null 2>&1

  # Verify all containers removed
  ssh -i "${HOME}/.ssh/${EC2_KEY_NAME}" "ubuntu@${EC2_DEPLOY_HOST}" "if [ -z \"\$(docker ps -aq)\" ]; then echo 'All containers removed.'; else echo 'Some containers remain!'; fi"

  # Remove generated files

  echo "✔ Nuke complete. Server cleaned."
  echo ""
}

cmd_new() {
  if [ -f .env ]; then
    echo "✘ .env file already exists! Aborting to prevent overwrite."
    exit 1
  fi
  echo "This will create a new .env file for your application."
  APP_NAME=$(echo "${PWD##*/}" | tr ' ' '-')
  APP_VERSION="latest"
  echo "Do you have a Docker Hub account and Personal Access Token (PAT)? (y/n  default: n)"
  read -r has_docker_account
  if [ "$has_docker_account" != "n" ] && [ "$has_docker_account" != "N" ] && [ "$has_docker_account" != "" ]; then
    echo "What is your Docker Hub username?"
    read -r docker_username
    DOCKER_USERNAME=$docker_username
    echo "Enter Docker Hub Personal Access Token: "
    read -r docker_pat
    DOCKER_PAT=$docker_pat
  else
    DOCKER_USERNAME="none"
    DOCKER_PAT="none"
  fi
  echo "Are you deploying to an AWS EC2 instance? (y/n  default: n)"
  read -r has_ec2
  if [ "$has_ec2" != "n" ] && [ "$has_ec2" != "N" ] && [ "$has_ec2" != "" ]; then
      echo "What is the EC2 public IP?"
      read -r ec2_deploy_host
      EC2_DEPLOY_HOST=$ec2_deploy_host
      echo "Your EC2 SSH key must be located in the $HOME/.ssh directory or validation will fail."
      echo "What is the name of your EC2 SSH key (e.g., aws-yourname.pem)?"
      read -r ec2_key_name
      EC2_KEY_NAME=$ec2_key_name
      echo "Check for AWS SSH key..."
      if [ ! -f "$HOME/.ssh/${EC2_KEY_NAME}" ]; then
        echo "✘ SSH key $HOME/.ssh/${EC2_KEY_NAME} not found! Please place your EC2 SSH key in the .ssh directory."
        exit 1
      else
        echo "✔ SSH key found."
        chmod 600 "$HOME/.ssh/${EC2_KEY_NAME}"
  fi
  else
      EC2_DEPLOY_HOST="localhost"
      EC2_KEY_NAME="none"
  fi

  EC2_DEPLOY_DIR="/home/ubuntu/${APP_NAME}"
  {
    echo "APP_NAME=${APP_NAME}"
    echo "APP_VERSION=${APP_VERSION}"
    echo "EC2_DEPLOY_HOST=${EC2_DEPLOY_HOST}"
    echo "EC2_DEPLOY_DIR=${EC2_DEPLOY_DIR}"
    echo "EC2_KEY_NAME=${EC2_KEY_NAME}"
    echo "DOCKER_USERNAME=${DOCKER_USERNAME}"
    echo "DOCKER_PAT=${DOCKER_PAT}"
  } > .env
  echo "✔ .env file created."
  echo "Initializing new development environment..."
  load_env
  cmd_init
  echo "New dev environment setup complete."
  echo "Run './dev.sh build install' to build and install the application."
}

install_completion() {
  local shell_rc
  local shell_name

  # Detect shell type
  if [[ "$SHELL" == *"zsh"* ]]; then
    shell_rc="$HOME/.zshrc"
    shell_name="zsh"
  else
    shell_rc="$HOME/.bashrc"
    shell_name="bash"
  fi

  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local completion_path="$script_dir/lib/dev.sh.completion"

  # Check if already installed
  if grep -q "source.*dev.sh.completion" "$shell_rc" 2>/dev/null; then
    echo "✔ Bash completion already installed in $shell_rc"
    return 0
  fi

  # Add completion to shell config
  {
    echo ""
    echo "# Enable bash completion for dev.sh"
    echo "[ -f \"$completion_path\" ] && source \"$completion_path\""
  } >> "$shell_rc"

  echo "✔ Bash completion installed in $shell_rc"
  echo "Run 'source $shell_rc' or restart your shell to enable it."
}

cmd_grade() {
  grade_project
  exit 0
}

cmd_all() {
  echo "Running all steps: build, push, deploy..."
  cmd_build
  cmd_push
  cmd_deploy
}

cmd_help() {
  print_fancy_box "dev.sh — Development & Deployment Helper" 70
  print_blank

  print_section "Configure commands"
  print_command "[e ] env" "Verify and load .env (CI prints info only)"
  print_command "[n ] new" "Create a new .env file interactively"
  print_command "[i ] init" "Generate docker-compose.yml from template"
  print_command "[ln] login" "Run docker + EC2 checks"
  print_blank

  print_section "Development commands"
  print_command "[u ] up" "Build images and start services"
  print_command "[dn] down" "Stop services"
  print_command "[b ] build" "Build Docker images without cache"
  print_command "[a ] all" "Build, push, deploy in sequence"
  print_blank

  print_section "EC2 commands"
  print_command "[w ] web" "Print EC2 web address"
  print_command "[ow] open-web" "Open EC2 application in browser"
  print_command "[s ] ssh" "SSH into the EC2 instance"
  print_command "[lg] logs" "Tail service logs on EC2"
  print_command "[ec] ec2" "Verify EC2 SSH connectivity and env vars"
  print_command "[dy] deploy" "Upload compose and start services on EC2 from your local machine"
  print_command "[dl] install" "Install web app on EC2 instance directly from the server"
  print_blank

  print_section "Docker Hub commands"
  print_command "[dk] docker" "Authenticate Docker Hub credentials"
  print_command "[p ] push" "Push Docker images to registry"
  print_blank

  print_section "Maintenance commands"
  print_command "[c ] clean" "Remove containers, images, volumes; purge local data"
  print_command "[xl] nuke" "Destroy local .env, compose, Docker resources, data"
  print_command "[xs] nuke-server" "Remove all deployed resources on EC2"
  print_command "[h ] help" "Show this help message"
  print_command "default" "No args runs 'up'"
  print_blank

  print_section "Grading"
  print_command "[xx] grade-project" "Grade the project for TA review"
  print_blank

  print_section "Usage"
  echo "  ./dev.sh [command ...]"
  echo ""
  echo "Examples:"
  echo "  ./dev.sh new                # Create new .env file"
  echo "  ./dev.sh login              # Verify Docker and EC2 connectivity"
  echo "  ./dev.sh up                 # Build and start services"
  echo "  ./dev.sh build push deploy  # Build, push, and deploy in sequence from local machine"
  echo "  ./dev.sh build install      # Install web app on EC2 instance directly from the server"
  echo ""
}

# Dispatch
main() {
  if [ $# -eq 0 ]; then
    # Default target is help if no arguments provided
    cmd_help
    exit 0
  fi

  for cmd in "$@"; do
    case "$cmd" in
      new|n) cmd_new ;;
      env|e) cmd_env ;;
      login|ln) cmd_login ;;
      ssh|s) cmd_ssh ;;
      init|i) cmd_init ;;
      up|u) cmd_up ;;
      down|dn) cmd_down ;;
      build|b) cmd_build ;;
      push|p) cmd_push ;;
      docker|dk) cmd_docker ;;
      ec2|ec) cmd_ec2 ;;
      deploy|dy) cmd_deploy ;;
      install|dl) cmd_install ;;
      logs|lg) cmd_logs ;;
      web|w) cmd_web ;;
      open-web|ow) cmd_open_web ;;
      all|a) cmd_all ;;
      clean|c) cmd_clean ;;
      nuke|xl) cmd_nuke ;;
      nuke-server|xs) cmd_nuke_server ;;
      grade-project|xx) cmd_grade ;;
      help|h) cmd_help ;;
      *)
        echo "Unknown command: $cmd"
        cmd_help
        exit 1
        ;;
    esac
  done
}

main "$@"
