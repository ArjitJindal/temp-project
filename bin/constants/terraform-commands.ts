export const installTerraform: string[] = [
  "curl -s -qL -o terraform_install.zip https://releases.hashicorp.com/terraform/1.3.7/terraform_1.3.7_linux_amd64.zip",
  "unzip terraform_install.zip -d /usr/bin/",
  "chmod +x /usr/bin/terraform",
];
