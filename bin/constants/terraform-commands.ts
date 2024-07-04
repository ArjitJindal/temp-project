export const installTerraform: string[] = [
  'curl -s -qL -o terraform_install.zip https://releases.hashicorp.com/terraform/1.9.1/terraform_1.9.1_linux_amd64.zip',
  'unzip terraform_install.zip -d /usr/bin/',
  'chmod +x /usr/bin/terraform',
]
